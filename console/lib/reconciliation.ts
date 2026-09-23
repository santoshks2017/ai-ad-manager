/**
 * Lead reconciliation.
 *
 * Compares the leads we hold against the conversions Google and Meta report,
 * per showroom, per platform, per day.
 *
 * Why this matters more than it looks: CPL is spend divided by leads. Spend
 * comes from the platform; the lead count does not have to. If the console
 * quotes a CPL from platform conversion data and the dealer counts leads in
 * their own system, the two numbers will disagree — and an unexplained
 * disagreement at invoice time is precisely the dispute that contributed to the
 * FY25 shutdown. Making the gap visible, and naming its likely cause, is the
 * point.
 *
 * Two structural reasons the numbers never match exactly:
 *  - Pixels miss form fills (ad blockers, consent refusals, script failures).
 *  - Calls to the virtual number are invisible to the ad platforms entirely,
 *    so they appear in our records and never in theirs.
 *
 * A gap is therefore expected. A LARGE gap, or a gap in the wrong direction,
 * is what needs attention.
 */

import type { Lead, MetricsDaily, Platform } from "./types"

export type GapVerdict =
  | "aligned"          // within tolerance
  | "calls_uncounted"  // we hold more than the platform saw — usually phone leads
  | "tracking_gap"     // platform counted more than we captured
  | "no_platform_data"
  | "no_leads"

export interface ReconciliationRow {
  dealerId: string
  platform: Platform
  /** Conversions the ad platform reported. */
  platformLeads: number
  /** Leads we actually hold. */
  capturedLeads: number
  /** Of those, ones that arrived as calls — invisible to the platforms. */
  callLeads: number
  /** Captured minus platform. Positive means we hold more than they saw. */
  gap: number
  gapPercent: number
  verdict: GapVerdict
  /** CPL on platform conversions, which is what the platform optimises toward. */
  platformCpl: number | null
  /** CPL on leads we can actually evidence. This is the defensible number. */
  capturedCpl: number | null
  spend: number
  explanation: string
}

/** Below this, a gap is normal measurement noise rather than a problem. */
const TOLERANCE = 0.1

function verdictFor(
  platformLeads: number,
  captured: number,
  callLeads: number,
): GapVerdict {
  if (platformLeads === 0 && captured === 0) return "no_leads"
  if (platformLeads === 0) return "no_platform_data"

  const ratio = (captured - platformLeads) / platformLeads
  if (Math.abs(ratio) <= TOLERANCE) return "aligned"
  // More than they saw is explained by calls, but only if calls cover the gap.
  if (ratio > 0) return callLeads >= captured - platformLeads ? "calls_uncounted" : "aligned"
  return "tracking_gap"
}

function explain(row: Omit<ReconciliationRow, "explanation">): string {
  const pct = Math.abs(Math.round(row.gapPercent * 100))
  switch (row.verdict) {
    case "aligned":
      return "Our records and the platform agree within normal measurement noise."
    case "calls_uncounted":
      return `We hold ${pct}% more leads than the platform counted, and ${row.callLeads} of them came in by phone. Calls to the tracking number never reach Google or Meta, so their bidding is optimising without them.`
    case "tracking_gap":
      return `The platform counted ${pct}% more conversions than we captured. That usually means the pixel is firing on visits we have no lead record for — worth checking before this CPL is quoted to the dealer.`
    case "no_platform_data":
      return "We hold leads the platform has no record of at all. Either conversion tracking is not configured, or every lead here arrived by phone."
    case "no_leads":
      return "No leads and no conversions in this period."
  }
}

export function reconcile(
  leads: Lead[],
  metrics: MetricsDaily[],
  opts: { dealerId?: string; from?: string; to?: string } = {},
): ReconciliationRow[] {
  const inRange = <T extends { date?: string; receivedAt?: string }>(d: string) =>
    (!opts.from || d >= opts.from) && (!opts.to || d <= opts.to)

  const scopedMetrics = metrics.filter(
    (m) => (!opts.dealerId || m.dealerId === opts.dealerId) && inRange(m.date),
  )
  const scopedLeads = leads.filter(
    (l) =>
      (!opts.dealerId || l.dealerId === opts.dealerId) &&
      inRange(l.receivedAt.slice(0, 10)),
  )

  const keys = new Set<string>()
  for (const m of scopedMetrics) keys.add(`${m.dealerId}|${m.platform}`)
  for (const l of scopedLeads) keys.add(`${l.dealerId}|${l.platform}`)

  const rows: ReconciliationRow[] = []

  for (const key of keys) {
    const [dealerId, platform] = key.split("|") as [string, Platform]

    const mine = scopedLeads.filter(
      (l) => l.dealerId === dealerId && l.platform === platform,
    )
    const theirs = scopedMetrics.filter(
      (m) => m.dealerId === dealerId && m.platform === platform,
    )

    const platformLeads = theirs.reduce((s, m) => s + m.leads, 0)
    const spend = theirs.reduce((s, m) => s + m.spend, 0)
    const capturedLeads = mine.length
    const callLeads = mine.filter((l) => l.source === "call").length

    const gap = capturedLeads - platformLeads
    const gapPercent = platformLeads > 0 ? gap / platformLeads : 0
    const verdict = verdictFor(platformLeads, capturedLeads, callLeads)

    const base = {
      dealerId, platform, platformLeads, capturedLeads, callLeads, gap, gapPercent,
      verdict,
      platformCpl: platformLeads > 0 ? spend / platformLeads : null,
      capturedCpl: capturedLeads > 0 ? spend / capturedLeads : null,
      spend,
    }
    rows.push({ ...base, explanation: explain(base) })
  }

  // Worst disagreement first — that is the queue to work through.
  return rows.sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent))
}

/** Roll the per-platform rows into one line per showroom. */
export function reconciliationSummary(rows: ReconciliationRow[]): {
  platformLeads: number
  capturedLeads: number
  callLeads: number
  gap: number
  gapPercent: number
  needsAttention: number
} {
  const platformLeads = rows.reduce((s, r) => s + r.platformLeads, 0)
  const capturedLeads = rows.reduce((s, r) => s + r.capturedLeads, 0)
  const callLeads = rows.reduce((s, r) => s + r.callLeads, 0)
  const gap = capturedLeads - platformLeads
  return {
    platformLeads,
    capturedLeads,
    callLeads,
    gap,
    gapPercent: platformLeads > 0 ? gap / platformLeads : 0,
    needsAttention: rows.filter(
      (r) => r.verdict === "tracking_gap" || r.verdict === "no_platform_data",
    ).length,
  }
}
