/**
 * Optimisation rule engine.
 *
 * Detects what needs changing and proposes it. It does NOT apply anything —
 * proposals go to an approval queue, and applying them is a separate,
 * rate-limit-aware step.
 *
 * Why it is built this way:
 *   - Meta caps ad-set budget changes at 4/hour and spend changes at 10/day.
 *     A loop that "optimises continuously" would breach that within an hour.
 *   - Frequent adjustment actively hurts results: it resets the platforms' own
 *     learning phase. Observing continuously and intervening rarely is both
 *     compliant and better practice.
 *   - Every proposal carries a written rationale, because the dealer-facing
 *     portal has to show what was done and why, in plain language.
 *
 * Deterministic rules live here. They cover the unambiguous cases cheaply and
 * predictably. LLM reasoning sits on top for the contextual judgement rules
 * cannot express — it never replaces these.
 */

import type {
  Campaign, Dealer, MetricsDaily, OptimizationKind, Platform,
} from "./types"

export interface Proposal {
  campaignId: string
  dealerId: string
  kind: OptimizationKind
  rationale: string
  proposedChange: Record<string, unknown>
  priorState: Record<string, unknown> | null
  /**
   * False only for changes that are reversible, low-risk and unambiguous.
   * Anything touching budget allocation, targeting or creative asks a human.
   */
  requiresApproval: boolean
  /** Higher sorts first in the queue. */
  severity: number
}

export interface OptimizerContext {
  dealer: Dealer
  campaigns: Campaign[]
  metrics: MetricsDaily[]
  now?: Date
}

const DAY = 86_400_000

function window(metrics: MetricsDaily[], from: Date, to: Date): MetricsDaily[] {
  const f = from.toISOString().slice(0, 10)
  const t = to.toISOString().slice(0, 10)
  return metrics.filter((m) => m.date >= f && m.date <= t)
}

function total(metrics: MetricsDaily[]) {
  return metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      leads: acc.leads + m.leads,
      clicks: acc.clicks + m.clicks,
      impressions: acc.impressions + m.impressions,
    }),
    { spend: 0, leads: 0, clicks: 0, impressions: 0 },
  )
}

const cplOf = (t: { spend: number; leads: number }) =>
  t.leads > 0 ? t.spend / t.leads : null

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

/**
 * Rule 1 — burning budget with nothing to show.
 *
 * Auto-applicable: pausing is instantly reversible, the prior state is stored,
 * and spending 3× the target CPL for zero leads has no benign reading.
 */
function zeroConversionBurn(ctx: OptimizerContext): Proposal[] {
  const now = ctx.now ?? new Date()
  const target = ctx.dealer.committedCpl
  if (!target) return []

  const out: Proposal[] = []
  for (const c of ctx.campaigns) {
    if (c.status !== "active") continue
    const recent = window(
      ctx.metrics.filter((m) => m.campaignId === c.id),
      new Date(now.getTime() - 6 * DAY),
      now,
    )
    if (recent.length < 3) continue

    const t = total(recent)
    if (t.leads === 0 && t.spend > target * 3) {
      out.push({
        campaignId: c.id,
        dealerId: ctx.dealer.id,
        kind: "pause_underperformer",
        rationale:
          `This campaign has spent ${inr(t.spend)} over ${recent.length} days with no leads — ` +
          `more than three times the ${inr(target)} target CPL with nothing to show. ` +
          `Pausing stops the spend; the budget returns to what is converting.`,
        proposedChange: { action: "pause" },
        priorState: { status: c.status, dailyBudget: c.dailyBudget },
        requiresApproval: false,
        severity: 90,
      })
    }
  }
  return out
}

/**
 * Rule 2 — one platform is clearly beating the other for this dealer.
 *
 * Needs approval: reallocating budget across platforms changes the shape of
 * delivery, and the account manager may know something the data does not.
 */
function platformImbalance(ctx: OptimizerContext): Proposal[] {
  const now = ctx.now ?? new Date()
  const recent = window(ctx.metrics, new Date(now.getTime() - 7 * DAY), now)

  const byPlatform = new Map<Platform, ReturnType<typeof total>>()
  for (const p of ["google", "meta"] as Platform[]) {
    const rows = recent.filter((m) => m.platform === p)
    if (rows.length > 0) byPlatform.set(p, total(rows))
  }
  if (byPlatform.size < 2) return []

  const g = byPlatform.get("google")!
  const m = byPlatform.get("meta")!
  const gCpl = cplOf(g)
  const mCpl = cplOf(m)
  if (!gCpl || !mCpl) return []

  const [better, worse, betterCpl, worseCpl] =
    mCpl < gCpl ? ["Meta", "Google", mCpl, gCpl] : ["Google", "Meta", gCpl, mCpl]

  const gap = (worseCpl - betterCpl) / worseCpl
  if (gap < 0.4) return []

  const worsePlatform = (worse.toLowerCase() as Platform)
  const campaign = ctx.campaigns.find(
    (c) => c.platform === worsePlatform && c.status === "active",
  )
  if (!campaign) return []

  const shift = Math.round(campaign.dailyBudget * 0.15)

  return [
    {
      campaignId: campaign.id,
      dealerId: ctx.dealer.id,
      kind: "shift_budget",
      rationale:
        `${better} is delivering leads at ${inr(betterCpl)} against ${inr(worseCpl)} on ${worse} ` +
        `for this dealer over the last 7 days. Moving 15% of daily budget ` +
        `(${inr(shift)}) from ${worse} to ${better} should lift total lead volume at the same spend.`,
      proposedChange: {
        from: worse.toLowerCase(),
        to: better.toLowerCase(),
        amountPerDay: shift,
      },
      priorState: { dailyBudget: campaign.dailyBudget },
      requiresApproval: true,
      severity: 60,
    },
  ]
}

/**
 * Rule 3 — the month is going to overspend.
 *
 * Projects month-end spend from the run rate so far. Trims the daily cap rather
 * than pausing, which keeps delivery alive.
 */
function budgetPacing(ctx: OptimizerContext): Proposal[] {
  const now = ctx.now ?? new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  if (dayOfMonth < 5) return [] // too early to read a run rate

  const monthSpend = total(window(ctx.metrics, monthStart, now)).spend
  const projected = (monthSpend / dayOfMonth) * daysInMonth
  const cap = ctx.dealer.monthlyBudget
  if (projected <= cap * 1.1) return []

  const campaign = ctx.campaigns.find((c) => c.status === "active")
  if (!campaign) return []

  const daysLeft = daysInMonth - dayOfMonth
  const remaining = Math.max(0, cap - monthSpend)
  const safeDaily = daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0
  const overBy = Math.round(((projected - cap) / cap) * 100)

  return [
    {
      campaignId: campaign.id,
      dealerId: ctx.dealer.id,
      kind: "pacing_correction",
      rationale:
        `Spend is pacing to ${inr(projected)} against a ${inr(cap)} monthly cap — ` +
        `roughly ${overBy}% over, with ${daysLeft} days left. Trimming the daily cap to ` +
        `${inr(safeDaily)} keeps the month inside budget without pausing delivery.`,
      proposedChange: {
        dailyBudgetFrom: campaign.dailyBudget,
        dailyBudgetTo: safeDaily,
      },
      priorState: { dailyBudget: campaign.dailyBudget },
      requiresApproval: true,
      severity: 80,
    },
  ]
}

/**
 * Rule 4 — CPL has drifted above what we committed to the dealer.
 *
 * This is the one that matters commercially. An unexplained overrun at invoice
 * time is how disputes start, so it surfaces early rather than at month end.
 */
function cplBreach(ctx: OptimizerContext): Proposal[] {
  const now = ctx.now ?? new Date()
  const target = ctx.dealer.committedCpl
  if (!target) return []

  const recent = window(ctx.metrics, new Date(now.getTime() - 7 * DAY), now)
  const t = total(recent)
  const cpl = cplOf(t)
  if (!cpl || cpl <= target * 1.15) return []

  const campaign = ctx.campaigns.find((c) => c.status === "active")
  if (!campaign) return []

  const overBy = Math.round(((cpl - target) / target) * 100)

  return [
    {
      campaignId: campaign.id,
      dealerId: ctx.dealer.id,
      kind: "adjust_bid",
      rationale:
        `Blended CPL over the last 7 days is ${inr(cpl)} against the ${inr(target)} committed ` +
        `to this dealer — ${overBy}% over. Tightening bids and cutting the weakest ` +
        `placements should pull it back before the month closes.`,
      proposedChange: { action: "tighten_bids", targetCpl: target },
      priorState: { observedCpl: Math.round(cpl) },
      requiresApproval: true,
      severity: 85,
    },
  ]
}

/**
 * Rule 5 — creative is wearing out.
 *
 * Compares the last 7 days' CTR against the 7 days before it. A sharp drop with
 * meaningful volume behind it usually means frequency has caught up.
 */
function creativeFatigue(ctx: OptimizerContext): Proposal[] {
  const now = ctx.now ?? new Date()
  const recent = total(window(ctx.metrics, new Date(now.getTime() - 7 * DAY), now))
  const prior = total(
    window(ctx.metrics, new Date(now.getTime() - 14 * DAY), new Date(now.getTime() - 8 * DAY)),
  )
  if (recent.impressions < 5000 || prior.impressions < 5000) return []

  const recentCtr = recent.clicks / recent.impressions
  const priorCtr = prior.clicks / prior.impressions
  if (priorCtr === 0) return []

  const drop = (priorCtr - recentCtr) / priorCtr
  if (drop < 0.3) return []

  const campaign = ctx.campaigns.find((c) => c.status === "active")
  if (!campaign) return []

  return [
    {
      campaignId: campaign.id,
      dealerId: ctx.dealer.id,
      kind: "refresh_creative",
      rationale:
        `Click-through has fallen ${Math.round(drop * 100)}% against the previous week ` +
        `(${(priorCtr * 100).toFixed(2)}% to ${(recentCtr * 100).toFixed(2)}%). ` +
        `The audience has seen this creative enough times that it has stopped working — ` +
        `new creative should recover it.`,
      proposedChange: { action: "refresh_creative" },
      priorState: { priorCtr, recentCtr },
      requiresApproval: true,
      severity: 50,
    },
  ]
}

const RULES = [
  zeroConversionBurn,
  cplBreach,
  budgetPacing,
  platformImbalance,
  creativeFatigue,
]

/** Run every rule for one dealer, highest severity first. */
export function detect(ctx: OptimizerContext): Proposal[] {
  return RULES.flatMap((rule) => rule(ctx)).sort((a, b) => b.severity - a.severity)
}
