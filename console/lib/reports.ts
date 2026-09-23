/**
 * Performance reports.
 *
 * One report per showroom per period: what was spent, what it produced, how
 * that compares with the commitment and the period before, and what we changed.
 *
 * This is the artifact the dealer sees, so two constraints from the Dealer
 * Campaign Portal PRD apply and are not stylistic preferences:
 *
 *  1. The activity log is "professional, expert, team-attributed — never
 *     attributed to automated systems". The optimisation engine produces the
 *     substance; the wording presents it as the account team's work, because
 *     that is what the dealer is paying for and what rebuilds the trust the
 *     FY25 shutdown destroyed.
 *
 *  2. No raw API data, no system identifiers, no jargon.
 *
 * The insight line is templated rather than free-generated. A report that goes
 * to a dealer unreviewed should not be able to say something surprising.
 */

import type {
  Campaign, Dealer, MetricsDaily, Optimization, Platform,
} from "./types"

export type ReportPeriod = "week" | "month"

export interface ReportActivity {
  date: string
  title: string
  whatWeDid: string
  why: string
}

export interface Report {
  dealerId: string
  period: ReportPeriod
  periodStart: string
  periodEnd: string
  spend: number
  leads: number
  cpl: number | null
  committedCpl: number | null
  /** Positive means we beat the commitment. */
  cplVsCommitted: number | null
  previousSpend: number
  previousLeads: number
  previousCpl: number | null
  cplChange: number | null
  platforms: { platform: Platform; spend: number; leads: number; cpl: number | null }[]
  topCampaign: { name: string; leads: number; cpl: number | null } | null
  activity: ReportActivity[]
  insight: string
  generatedAt: string
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

function boundaries(period: ReportPeriod, now: Date) {
  const days = period === "week" ? 7 : 30
  const end = new Date(now.getTime() - 86_400_000)
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  const prevEnd = new Date(start.getTime() - 86_400_000)
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return {
    start: iso(start), end: iso(end),
    prevStart: iso(prevStart), prevEnd: iso(prevEnd),
  }
}

function sum(rows: MetricsDaily[]) {
  return rows.reduce(
    (a, m) => ({ spend: a.spend + m.spend, leads: a.leads + m.leads }),
    { spend: 0, leads: 0 },
  )
}

/**
 * Rewrite an optimisation into something a dealer reads without flinching.
 *
 * The engine's own rationale is written for an account manager and mentions
 * platforms, budgets and thresholds directly. This keeps the substance and
 * drops the machinery.
 */
function toActivity(o: Optimization): ReportActivity {
  const map: Record<string, { title: string; why: string }> = {
    pause_underperformer: {
      title: "Paused an ad set that was not converting",
      why: "It was consuming budget without producing enquiries, so that spend has been returned to the ads that are working.",
    },
    shift_budget: {
      title: "Rebalanced budget between channels",
      why: "One channel was producing enquiries more efficiently than the other, so more of the daily budget now goes there.",
    },
    adjust_bid: {
      title: "Tightened bidding to bring cost per enquiry down",
      why: "Cost per enquiry had drifted above the agreed level, so bids and the weakest placements were adjusted.",
    },
    expand_targeting: {
      title: "Widened the audience",
      why: "Delivery was constrained, which was limiting how many enquiries the budget could generate.",
    },
    refresh_creative: {
      title: "Refreshed the ad creative",
      why: "The audience had seen the existing creative often enough that response was falling.",
    },
    pacing_correction: {
      title: "Adjusted daily spend to stay within budget",
      why: "Spend was tracking above the monthly plan, so the daily limit was brought back in line.",
    },
  }
  const copy = map[o.kind] ?? {
    title: "Campaign adjustment",
    why: "Applied as part of ongoing optimisation of this campaign.",
  }
  return {
    date: (o.appliedAt ?? o.decidedAt ?? o.createdAt).slice(0, 10),
    title: copy.title,
    whatWeDid: copy.title,
    why: copy.why,
  }
}

function buildInsight(r: Omit<Report, "insight">): string {
  const period = r.period === "week" ? "week" : "month"

  if (r.leads === 0) {
    return `No enquiries came through this ${period}. We are reviewing targeting and delivery, and will have this corrected before the next report.`
  }
  if (r.cpl === null) return ""

  const parts: string[] = [
    `This ${period} your campaigns generated ${r.leads} enquir${r.leads === 1 ? "y" : "ies"} at ${inr(r.cpl)} each.`,
  ]

  if (r.committedCpl !== null) {
    const diff = Math.round(((r.committedCpl - r.cpl) / r.committedCpl) * 100)
    parts.push(
      diff >= 0
        ? `That is ${diff}% better than the ${inr(r.committedCpl)} we committed to.`
        : `That is ${Math.abs(diff)}% above the ${inr(r.committedCpl)} we committed to, and bringing it back down is our priority for the coming ${period}.`,
    )
  }

  if (r.cplChange !== null && Math.abs(r.cplChange) > 0.05) {
    const pct = Math.abs(Math.round(r.cplChange * 100))
    parts.push(
      r.cplChange < 0
        ? `Cost per enquiry improved ${pct}% on the previous ${period}.`
        : `Cost per enquiry rose ${pct}% on the previous ${period}.`,
    )
  }

  if (r.topCampaign && r.topCampaign.cpl !== null) {
    parts.push(
      `Your strongest campaign was ${r.topCampaign.name}, at ${inr(r.topCampaign.cpl)} per enquiry.`,
    )
  }

  if (r.activity.length > 0) {
    parts.push(
      `We made ${r.activity.length} change${r.activity.length === 1 ? "" : "s"} to your campaigns during the period.`,
    )
  }

  return parts.join(" ")
}

export function buildReport(
  dealer: Dealer,
  campaigns: Campaign[],
  metrics: MetricsDaily[],
  optimizations: Optimization[],
  period: ReportPeriod = "week",
  now = new Date(),
): Report {
  const b = boundaries(period, now)

  const mine = metrics.filter((m) => m.dealerId === dealer.id)
  const current = mine.filter((m) => m.date >= b.start && m.date <= b.end)
  const previous = mine.filter((m) => m.date >= b.prevStart && m.date <= b.prevEnd)

  const cur = sum(current)
  const prev = sum(previous)
  const cpl = cur.leads > 0 ? cur.spend / cur.leads : null
  const previousCpl = prev.leads > 0 ? prev.spend / prev.leads : null

  const platforms = (["google", "meta"] as Platform[])
    .map((platform) => {
      const t = sum(current.filter((m) => m.platform === platform))
      return {
        platform,
        spend: t.spend,
        leads: t.leads,
        cpl: t.leads > 0 ? t.spend / t.leads : null,
      }
    })
    .filter((p) => p.spend > 0)

  // Best campaign is the one with the lowest cost per enquiry, not the most
  // leads — volume bought expensively is not a success worth reporting.
  const campaignRows = campaigns
    .filter((c) => c.dealerId === dealer.id)
    .map((c) => {
      const t = sum(current.filter((m) => m.campaignId === c.id))
      return {
        name: c.name,
        leads: t.leads,
        cpl: t.leads > 0 ? t.spend / t.leads : null,
      }
    })
    .filter((c) => c.leads > 0 && c.cpl !== null)
    .sort((a, b2) => (a.cpl ?? Infinity) - (b2.cpl ?? Infinity))

  const activity = optimizations
    .filter(
      (o) =>
        o.dealerId === dealer.id &&
        (o.status === "applied" || o.status === "approved") &&
        (o.appliedAt ?? o.decidedAt ?? o.createdAt).slice(0, 10) >= b.start,
    )
    .map(toActivity)
    .sort((a, b2) => b2.date.localeCompare(a.date))

  const base: Omit<Report, "insight"> = {
    dealerId: dealer.id,
    period,
    periodStart: b.start,
    periodEnd: b.end,
    spend: cur.spend,
    leads: cur.leads,
    cpl,
    committedCpl: dealer.committedCpl,
    cplVsCommitted:
      dealer.committedCpl && cpl !== null
        ? (dealer.committedCpl - cpl) / dealer.committedCpl
        : null,
    previousSpend: prev.spend,
    previousLeads: prev.leads,
    previousCpl,
    cplChange:
      cpl !== null && previousCpl !== null && previousCpl > 0
        ? (cpl - previousCpl) / previousCpl
        : null,
    platforms,
    topCampaign: campaignRows[0] ?? null,
    activity,
    generatedAt: now.toISOString(),
  }

  return { ...base, insight: buildInsight(base) }
}
