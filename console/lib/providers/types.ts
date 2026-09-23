/**
 * Ad platform provider interface.
 *
 * Every platform implements this so the rest of the app never branches on
 * "is this Google or Meta". Campaign creation, budget changes and pausing all
 * go through here.
 *
 * Two kinds of implementation exist:
 *   - Live providers, which call the real APIs.
 *   - A simulator, which returns deterministic synthetic results.
 *
 * Which one ran is recorded on the result as `provenance`, and that value is
 * persisted with the record. This is deliberate: the previous codebase flipped
 * a SANDBOX_MODE env var and returned fabricated campaign IDs that were
 * indistinguishable from real ones downstream, which made "did this actually
 * happen?" unanswerable. Provenance travels with the data instead.
 */

import type { Objective, Platform, Provenance } from "../types"

export interface CreateCampaignInput {
  /** Our dealer code, used to build the attribution-bearing campaign name. */
  dealerCode: string
  dealerName: string
  brand: string
  model: string
  objective: Objective
  /** Daily budget in INR. */
  dailyBudget: number
  city: string
  /** Targeting radius in km around the city centre. */
  radiusKm: number
  startDate: string
  endDate: string | null
  /** The dealer's landing page. Built and hosted outside this console. */
  landingPageUrl: string
  /** The dealer's assigned virtual number, shown in call CTAs. */
  virtualNumber: string | null
  headline: string
  description: string
  /**
   * Go live on creation instead of staying paused.
   *
   * Default is paused. Spend cannot be unwound, so the safe default is that a
   * human looks before anything serves. Callers that genuinely want hands-off
   * activation opt in explicitly.
   */
  goLive?: boolean
  /** Optional offer line used in generated ad copy. */
  offer?: string | null
  /** The showroom's own Facebook Page. Meta ads cannot run without one. */
  metaPageId?: string | null
}

/** What a full build actually created, so the UI can report it honestly. */
export interface BuiltCampaign extends CampaignRef {
  adGroupId: string | null
  keywordCount: number
  negativeKeywordCount: number
  adCount: number
  status: "active" | "paused"
  /** Steps that failed after the campaign itself was created. */
  warnings: string[]
}

export interface ProviderResult<T> {
  ok: boolean
  data: T | null
  error: string | null
  provenance: Provenance
}

export interface CampaignRef {
  platformCampaignId: string
  name: string
}

export interface MetricsRow {
  campaignId: string
  date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
}

export interface AdProvider {
  readonly platform: Platform
  readonly provenance: Provenance

  /**
   * True when this provider has everything it needs to talk to the real API.
   * A live provider without credentials reports false rather than throwing at
   * call time, so the app can degrade visibly instead of failing mid-request.
   */
  isConfigured(): boolean

  /**
   * Create the campaign and everything under it — targeting, ad group,
   * keywords, negatives and ads — in one call.
   *
   * A campaign object on its own serves nothing. Returning "created" for an
   * empty shell would be reporting success for work that has not happened.
   */
  createCampaign(
    accountId: string,
    input: CreateCampaignInput,
  ): Promise<ProviderResult<BuiltCampaign>>

  pauseCampaign(accountId: string, campaignId: string): Promise<ProviderResult<null>>
  resumeCampaign(accountId: string, campaignId: string): Promise<ProviderResult<null>>

  setDailyBudget(
    accountId: string,
    campaignId: string,
    dailyBudget: number,
  ): Promise<ProviderResult<null>>

  fetchMetrics(
    accountId: string,
    from: string,
    to: string,
  ): Promise<ProviderResult<MetricsRow[]>>
}

/**
 * Campaign naming is the attribution mechanism.
 *
 * Both platforms require a separate ad account per advertiser, but campaigns
 * still need to be traceable to a dealer from the platform UI and from exported
 * reports without consulting our database. Encoding it in the name keeps that
 * true even when someone is looking at Google Ads directly.
 */
export function campaignName(input: CreateCampaignInput, date = new Date()): string {
  const ym = date.toISOString().slice(0, 7).replace("-", "")
  const clean = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")
  return [
    clean(input.dealerCode),
    clean(input.brand),
    clean(input.model),
    input.objective,
    ym,
  ].join("__")
}
