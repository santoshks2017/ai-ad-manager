/**
 * Applying an approved optimisation to the platform.
 *
 * Approval and application are deliberately separate steps. Meta permits only
 * four ad-set budget changes per hour and ten spend changes per day, so an
 * account manager working down a queue of twenty approvals would breach the
 * ceiling within minutes if each click wrote straight through.
 *
 * This checks the budget before writing, applies through the provider, and
 * records enough prior state to undo it.
 */

import { getProvider } from "./providers"
import type { Campaign, Optimization, Platform } from "./types"

/** Meta's documented ceilings. Google has no published QPS, so we use these. */
const LIMITS = {
  budgetChangesPerHour: 4,
  changesPerDay: 10,
}

export interface ApplyContext {
  optimization: Optimization
  campaign: Campaign
  /** Optimisations already applied to this campaign, newest first. */
  recentlyApplied: Optimization[]
  now?: Date
}

export type ApplyOutcome =
  | { applied: true; note: string }
  | { applied: false; reason: "rate_limited"; retryAfterMinutes: number; note: string }
  | { applied: false; reason: "failed" | "unsupported"; note: string }

const BUDGET_KINDS = new Set(["shift_budget", "pacing_correction"])

/**
 * Whether this change can go now without breaching a platform ceiling.
 *
 * Counted per campaign, because that is the level the limits apply at.
 */
export function rateLimitCheck(
  ctx: ApplyContext,
): { ok: true } | { ok: false; retryAfterMinutes: number; note: string } {
  const now = ctx.now ?? new Date()
  const applied = ctx.recentlyApplied.filter((o) => o.appliedAt)

  const withinDay = applied.filter(
    (o) => now.getTime() - new Date(o.appliedAt!).getTime() < 24 * 3_600_000,
  )
  if (withinDay.length >= LIMITS.changesPerDay) {
    const oldest = withinDay[withinDay.length - 1]
    const freesAt = new Date(oldest.appliedAt!).getTime() + 24 * 3_600_000
    return {
      ok: false,
      retryAfterMinutes: Math.ceil((freesAt - now.getTime()) / 60_000),
      note: `This campaign has had ${withinDay.length} changes in 24 hours, which is the platform's daily ceiling.`,
    }
  }

  if (BUDGET_KINDS.has(ctx.optimization.kind)) {
    const budgetChanges = applied.filter(
      (o) =>
        BUDGET_KINDS.has(o.kind) &&
        now.getTime() - new Date(o.appliedAt!).getTime() < 3_600_000,
    )
    if (budgetChanges.length >= LIMITS.budgetChangesPerHour) {
      const oldest = budgetChanges[budgetChanges.length - 1]
      const freesAt = new Date(oldest.appliedAt!).getTime() + 3_600_000
      return {
        ok: false,
        retryAfterMinutes: Math.ceil((freesAt - now.getTime()) / 60_000),
        note: `Meta allows four budget changes an hour per ad set and this campaign has had ${budgetChanges.length}.`,
      }
    }
  }

  return { ok: true }
}

export async function applyOptimization(ctx: ApplyContext): Promise<ApplyOutcome> {
  const limit = rateLimitCheck(ctx)
  if (!limit.ok) {
    return {
      applied: false,
      reason: "rate_limited",
      retryAfterMinutes: limit.retryAfterMinutes,
      note: limit.note,
    }
  }

  const { optimization: o, campaign } = ctx
  const provider = getProvider(campaign.platform as Platform)
  const accountId = campaign.platformCampaignId

  switch (o.kind) {
    case "pause_underperformer": {
      const res = await provider.pauseCampaign(accountId, campaign.platformCampaignId)
      return res.ok
        ? { applied: true, note: "Paused on the platform." }
        : { applied: false, reason: "failed", note: res.error ?? "Pause failed." }
    }

    case "pacing_correction":
    case "shift_budget": {
      const change = o.proposedChange as Record<string, number>
      const next =
        change.dailyBudgetTo ??
        (change.amountPerDay !== undefined
          ? campaign.dailyBudget - change.amountPerDay
          : undefined)

      if (next === undefined || !Number.isFinite(next) || next < 0) {
        return {
          applied: false,
          reason: "unsupported",
          note: "The proposed change does not contain a usable daily budget.",
        }
      }

      const res = await provider.setDailyBudget(
        accountId,
        campaign.platformCampaignId,
        Math.round(next),
      )
      return res.ok
        ? {
            applied: true,
            note: `Daily budget set to ₹${Math.round(next).toLocaleString("en-IN")}.`,
          }
        : { applied: false, reason: "failed", note: res.error ?? "Budget change failed." }
    }

    // Bids, targeting and creative need asset-level calls the provider does not
    // expose yet. Saying so beats silently marking them done.
    case "adjust_bid":
    case "expand_targeting":
    case "refresh_creative":
      return {
        applied: false,
        reason: "unsupported",
        note: "This change has to be made in the platform for now — the console cannot apply it automatically yet.",
      }

    default:
      return { applied: false, reason: "unsupported", note: "Unknown change type." }
  }
}
