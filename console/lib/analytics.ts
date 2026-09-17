/**
 * Analytics aggregations.
 *
 * Pure functions over metrics rows so they can be tested without a store and
 * reused by any report. Nothing here reads from the database or formats output.
 *
 * One rule runs through all of it: a rate is computed from summed totals, never
 * averaged from per-row rates. Averaging CPLs across days weights a ₹500 day
 * with two leads the same as a ₹50,000 day with two hundred, which quietly
 * misstates the number the whole business is judged on.
 */

import type { Campaign, Dealer, MetricsDaily, Platform } from "./types"

export interface Totals {
  spend: number
  impressions: number
  clicks: number
  leads: number
  cpl: number | null
  cpc: number | null
  ctr: number | null
  convRate: number | null
}

export function totals(rows: MetricsDaily[]): Totals {
  const t = rows.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      leads: acc.leads + m.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 },
  )
  return {
    ...t,
    cpl: t.leads > 0 ? t.spend / t.leads : null,
    cpc: t.clicks > 0 ? t.spend / t.clicks : null,
    ctr: t.impressions > 0 ? t.clicks / t.impressions : null,
    convRate: t.clicks > 0 ? t.leads / t.clicks : null,
  }
}

export interface DailyPoint {
  date: string
  spend: number
  leads: number
  cpl: number | null
}

/** One point per day present in the data, oldest first. */
export function daily(rows: MetricsDaily[]): DailyPoint[] {
  const byDate = new Map<string, { spend: number; leads: number }>()
  for (const m of rows) {
    const acc = byDate.get(m.date) ?? { spend: 0, leads: 0 }
    acc.spend += m.spend
    acc.leads += m.leads
    byDate.set(m.date, acc)
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({
      date,
      spend: v.spend,
      leads: v.leads,
      cpl: v.leads > 0 ? v.spend / v.leads : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface PlatformSplit {
  platform: Platform
  totals: Totals
  spendShare: number
  leadShare: number
}

export function byPlatform(rows: MetricsDaily[]): PlatformSplit[] {
  const all = totals(rows)
  return (["google", "meta"] as Platform[])
    .map((platform) => {
      const t = totals(rows.filter((m) => m.platform === platform))
      return {
        platform,
        totals: t,
        spendShare: all.spend > 0 ? t.spend / all.spend : 0,
        leadShare: all.leads > 0 ? t.leads / all.leads : 0,
      }
    })
    .filter((p) => p.totals.spend > 0)
}

export interface DealerPerformance {
  dealer: Dealer
  totals: Totals
  /** Actual CPL as a ratio of committed. Below 1 is good. Null when uncommitted. */
  cplRatio: number | null
  status: "under" | "near" | "over" | "unknown"
}

/**
 * Rank dealers by how their delivered CPL compares with what we promised.
 * Worst offenders first — the queue an account manager should work down.
 */
export function byDealer(
  dealers: Dealer[],
  rows: MetricsDaily[],
): DealerPerformance[] {
  return dealers
    .map((dealer) => {
      const t = totals(rows.filter((m) => m.dealerId === dealer.id))
      const cplRatio =
        dealer.committedCpl && t.cpl !== null ? t.cpl / dealer.committedCpl : null
      const status: DealerPerformance["status"] =
        cplRatio === null ? "unknown" : cplRatio > 1 ? "over" : cplRatio > 0.9 ? "near" : "under"
      return { dealer, totals: t, cplRatio, status }
    })
    .sort((a, b) => (b.cplRatio ?? -1) - (a.cplRatio ?? -1))
}

export interface SegmentPerformance {
  key: string
  city: string
  model: string
  platform: Platform
  totals: Totals
  dealerCount: number
}

/**
 * Performance by city × model × platform.
 *
 * This is the report that compounds: it is exactly the shape the projection
 * engine consumes as `historical` basis, so every month of delivery makes the
 * next quote tighter and better grounded.
 */
export function bySegment(
  dealers: Dealer[],
  campaigns: Campaign[],
  rows: MetricsDaily[],
): SegmentPerformance[] {
  const dealerById = new Map(dealers.map((d) => [d.id, d]))
  const campaignById = new Map(campaigns.map((c) => [c.id, c]))

  const groups = new Map<
    string,
    { city: string; model: string; platform: Platform; rows: MetricsDaily[]; dealers: Set<string> }
  >()

  for (const m of rows) {
    const dealer = dealerById.get(m.dealerId)
    if (!dealer) continue
    const campaign = m.campaignId ? campaignById.get(m.campaignId) : undefined
    // Campaign names carry the model; fall back to the dealer's primary model.
    const model = campaign?.name.split("__")[2] ?? dealer.models[0] ?? "unknown"
    const key = `${dealer.city}|${model}|${m.platform}`

    const g =
      groups.get(key) ??
      { city: dealer.city, model, platform: m.platform, rows: [], dealers: new Set<string>() }
    g.rows.push(m)
    g.dealers.add(dealer.id)
    groups.set(key, g)
  }

  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      city: g.city,
      model: g.model,
      platform: g.platform,
      totals: totals(g.rows),
      dealerCount: g.dealers.size,
    }))
    .sort((a, b) => b.totals.spend - a.totals.spend)
}

export interface Pacing {
  dealer: Dealer
  monthSpend: number
  monthlyBudget: number
  /** Spend projected to month end from the run rate so far. */
  projected: number
  utilisation: number
  status: "under" | "on_track" | "over"
  daysElapsed: number
  daysInMonth: number
}

export function pacing(
  dealers: Dealer[],
  rows: MetricsDaily[],
  now = new Date(),
): Pacing[] {
  const monthPrefix = now.toISOString().slice(0, 7)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()

  return dealers
    .filter((d) => d.status === "active")
    .map((dealer) => {
      const monthSpend = rows
        .filter((m) => m.dealerId === dealer.id && m.date.startsWith(monthPrefix))
        .reduce((s, m) => s + m.spend, 0)

      const projected = daysElapsed > 0 ? (monthSpend / daysElapsed) * daysInMonth : 0
      const utilisation = dealer.monthlyBudget > 0 ? projected / dealer.monthlyBudget : 0

      return {
        dealer,
        monthSpend,
        monthlyBudget: dealer.monthlyBudget,
        projected,
        utilisation,
        status: utilisation > 1.05 ? "over" : utilisation < 0.85 ? "under" : "on_track",
        daysElapsed,
        daysInMonth,
      } as Pacing
    })
    .sort((a, b) => b.utilisation - a.utilisation)
}

/** Percentage change from a previous period. Null when there is no baseline. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}

/** Split rows into the trailing window and the window immediately before it. */
export function periods(
  rows: MetricsDaily[],
  days: number,
  now = new Date(),
): { current: MetricsDaily[]; previous: MetricsDaily[] } {
  const d = (ago: number) =>
    new Date(now.getTime() - ago * 86_400_000).toISOString().slice(0, 10)
  const curFrom = d(days - 1)
  const prevFrom = d(days * 2 - 1)
  const prevTo = d(days)
  return {
    current: rows.filter((m) => m.date >= curFrom),
    previous: rows.filter((m) => m.date >= prevFrom && m.date <= prevTo),
  }
}
