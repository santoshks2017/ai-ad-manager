/**
 * Deterministic simulator.
 *
 * Stands in for a real platform so the console is fully exercisable before any
 * API credentials exist. It is not a mock in the testing sense — it models
 * plausible delivery so the optimisation rules have something realistic to
 * react to.
 *
 * Every result it returns is stamped provenance "simulated", and the UI shows
 * that on screen. Nothing here should ever be mistakable for real delivery.
 */

import { baseCpl, cityTier, modelSegment, objectiveMultiplier } from "../benchmarks"
import type { Platform } from "../types"
import {
  campaignName,
  type AdProvider,
  type CampaignRef,
  type CreateCampaignInput,
  type MetricsRow,
  type ProviderResult,
} from "./types"

/** Stable hash so the same campaign always produces the same numbers. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export class SimulatedProvider implements AdProvider {
  readonly provenance = "simulated" as const

  constructor(readonly platform: Platform) {}

  isConfigured(): boolean {
    return true
  }

  private ok<T>(data: T): ProviderResult<T> {
    return { ok: true, data, error: null, provenance: this.provenance }
  }

  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
  ): Promise<ProviderResult<CampaignRef>> {
    const name = campaignName(input)
    const id = `sim-${this.platform}-${hash(`${accountId}${name}`).toString(36)}`
    return this.ok({ platformCampaignId: id, name })
  }

  async pauseCampaign(): Promise<ProviderResult<null>> {
    return this.ok(null)
  }

  async resumeCampaign(): Promise<ProviderResult<null>> {
    return this.ok(null)
  }

  async setDailyBudget(): Promise<ProviderResult<null>> {
    return this.ok(null)
  }

  /**
   * Generate daily delivery for a campaign.
   *
   * CPL is derived from the same benchmark priors the projection engine uses,
   * so simulated delivery lands in the range the console would have quoted —
   * which is what makes the optimisation rules behave sensibly against it.
   */
  async fetchMetrics(
    accountId: string,
    from: string,
    to: string,
    opts?: {
      campaignId?: string
      city?: string
      model?: string
      objective?: CreateCampaignInput["objective"]
      dailyBudget?: number
    },
  ): Promise<ProviderResult<MetricsRow[]>> {
    const campaignId = opts?.campaignId ?? `sim-${this.platform}-default`
    const city = opts?.city ?? "Lucknow"
    const model = opts?.model ?? "Creta"
    const objective = opts?.objective ?? "leads"
    const dailyBudget = opts?.dailyBudget ?? 2000

    const [lo, hi] = baseCpl(modelSegment(model), this.platform)
    const tierMul = { metro: 1.32, tier1: 1.0, tier2: 0.82, tier3: 0.7 }[cityTier(city)]
    const mid = ((lo + hi) / 2) * tierMul * objectiveMultiplier(objective)

    const rand = seeded(hash(campaignId))
    const rows: MetricsRow[] = []

    const start = new Date(from)
    const end = new Date(to)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().slice(0, 10)
      const spend = Math.round(dailyBudget * (0.85 + rand() * 0.3))
      const cpl = mid * (0.75 + rand() * 0.6)
      const leads = Math.max(0, Math.round(spend / cpl))
      const clicks = Math.round(leads * (this.platform === "meta" ? 9 : 5) * (0.8 + rand() * 0.4))
      const impressions = Math.round(
        clicks * (this.platform === "meta" ? 55 : 14) * (0.8 + rand() * 0.4),
      )
      rows.push({ campaignId, date, spend, impressions, clicks, leads })
    }

    return this.ok(rows)
  }
}
