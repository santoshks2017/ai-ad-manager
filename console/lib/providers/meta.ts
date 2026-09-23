/**
 * Meta (Facebook + Instagram) provider.
 *
 * ⚠️ UNVERIFIED. Written against the documented Graph API but never executed
 * against a real endpoint — no app credentials exist yet. `isConfigured()`
 * returns false without them so the app falls back to the simulator.
 *
 * Account model: one ad account, one Page and one Business Portfolio per
 * dealer. Meta's Business Tools Terms state "each advertiser or client must be
 * managed through separate ad accounts", and every ad must run from a Page that
 * accurately represents the business being advertised — so dealer ads cannot
 * run off a CarDekho-branded Page. We create and administer these as the
 * dealer's authorised representative under a signed services agreement; the
 * dealer never signs in.
 *
 * Rate limits that shape usage:
 *   - Ad-set budget changes: 4 per hour. Hard ceiling, and the reason the
 *     optimisation loop batches rather than adjusting continuously.
 *   - Ad spend changes: 10 per day.
 *   - Business Use Case points: reads cost 1, writes cost 3.
 *
 * Lead data is deleted by Meta 90 days after submission and is unrecoverable,
 * so lead retrieval is a data-loss deadline, not a feature.
 */

import { metaAssets, taggedLandingUrl } from "../creative"
import type { Platform } from "../types"
import {
  campaignName,
  type AdProvider,
  type BuiltCampaign,
  type CreateCampaignInput,
  type MetricsRow,
  type ProviderResult,
} from "./types"

const API_VERSION = process.env.META_API_VERSION ?? "v21.0"
const BASE = `https://graph.facebook.com/${API_VERSION}`

/** Meta takes budgets in the account currency's minor unit — paise for INR. */
const toMinor = (inr: number) => String(Math.round(inr * 100))

const OBJECTIVE_MAP: Record<CreateCampaignInput["objective"], string> = {
  leads: "OUTCOME_LEADS",
  test_drive: "OUTCOME_LEADS",
  exchange: "OUTCOME_LEADS",
  model_launch: "OUTCOME_AWARENESS",
  festive_offer: "OUTCOME_TRAFFIC",
}

export class MetaAdsProvider implements AdProvider {
  readonly platform: Platform = "meta"
  readonly provenance = "live" as const

  private accessToken = process.env.META_ACCESS_TOKEN

  isConfigured(): boolean {
    return Boolean(this.accessToken)
  }

  private fail<T>(error: string): ProviderResult<T> {
    return { ok: false, data: null, error, provenance: this.provenance }
  }

  private notConfigured<T>(): ProviderResult<T> {
    return this.fail<T>(
      "Meta is not configured. Set META_ACCESS_TOKEN (a System User token from " +
        "the Business Portfolio, not a personal user token).",
    )
  }

  private async request<T>(
    path: string,
    method: "GET" | "POST",
    params: Record<string, string>,
  ): Promise<ProviderResult<T>> {
    try {
      const url = new URL(`${BASE}${path}`)
      const body = new URLSearchParams({ ...params, access_token: this.accessToken! })

      const res =
        method === "GET"
          ? await fetch(`${url.toString()}?${body.toString()}`)
          : await fetch(url.toString(), {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body,
            })

      const text = await res.text()
      if (!res.ok) {
        return this.fail<T>(`Meta API ${res.status}: ${text.slice(0, 400)}`)
      }
      return {
        ok: true,
        data: (text ? JSON.parse(text) : null) as T,
        error: null,
        provenance: this.provenance,
      }
    } catch (err) {
      return this.fail<T>(`Meta request failed: ${(err as Error).message}`)
    }
  }

  /**
   * Build the campaign, its ad set and a live ad.
   *
   * Meta needs three objects, not one: the campaign carries the objective, the
   * ad set carries budget, targeting and the promoted Page, and the ad carries
   * the creative. A campaign on its own delivers nothing.
   *
   * The Page is required and must be the SHOWROOM's own — Meta requires an ad
   * to represent the business being advertised, so a CarDekho Page here would
   * be a policy breach as well as confusing to the buyer.
   */
  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
  ): Promise<ProviderResult<BuiltCampaign>> {
    if (!this.isConfigured()) return this.notConfigured<BuiltCampaign>()
    if (!input.metaPageId) {
      return this.fail<BuiltCampaign>(
        "No Facebook Page on the showroom record. Meta ads must run from a Page " +
          "that represents the advertised business, so this cannot be created yet.",
      )
    }

    const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`
    const name = campaignName(input)
    const warnings: string[] = []
    const assets = metaAssets({
      dealerName: input.dealerName, brand: input.brand, model: input.model,
      city: input.city, objective: input.objective, offer: input.offer,
    })

    const campaignRes = await this.request<{ id?: string }>(`/${act}/campaigns`, "POST", {
      name,
      objective: OBJECTIVE_MAP[input.objective],
      status: input.goLive ? "ACTIVE" : "PAUSED",
      special_ad_categories: JSON.stringify([]),
      buying_type: "AUCTION",
    })
    if (!campaignRes.ok) return this.fail<BuiltCampaign>(campaignRes.error!)
    const campaignId = campaignRes.data?.id
    if (!campaignId) return this.fail<BuiltCampaign>("Meta returned no campaign id.")

    const adSetRes = await this.request<{ id?: string }>(`/${act}/adsets`, "POST", {
      name: `${input.model} — ${input.city}`,
      campaign_id: campaignId,
      daily_budget: toMinor(input.dailyBudget),
      billing_event: "IMPRESSIONS",
      optimization_goal: "LEAD_GENERATION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      status: input.goLive ? "ACTIVE" : "PAUSED",
      promoted_object: JSON.stringify({ page_id: input.metaPageId }),
      targeting: JSON.stringify({
        geo_locations: {
          custom_locations: [
            { latitude: 0, longitude: 0, radius: input.radiusKm, distance_unit: "kilometer" },
          ],
        },
        age_min: 22,
        age_max: 60,
        // Meta needs a placement set or it spreads across everything.
        publisher_platforms: ["facebook", "instagram"],
      }),
      start_time: new Date(input.startDate).toISOString(),
      ...(input.endDate ? { end_time: new Date(input.endDate).toISOString() } : {}),
    })
    if (!adSetRes.ok) {
      return {
        ok: true,
        data: {
          platformCampaignId: campaignId, name, adGroupId: null,
          keywordCount: 0, negativeKeywordCount: 0, adCount: 0,
          status: input.goLive ? "active" : "paused",
          warnings: [`Ad set failed: ${adSetRes.error}`],
        },
        error: null,
        provenance: this.provenance,
      }
    }
    const adSetId = adSetRes.data!.id!

    const link = taggedLandingUrl(input.landingPageUrl, {
      platform: "meta",
      dealerCode: input.dealerCode,
      model: input.model,
      objective: input.objective,
    })

    const creativeRes = await this.request<{ id?: string }>(`/${act}/adcreatives`, "POST", {
      name: `${name}__creative`,
      object_story_spec: JSON.stringify({
        page_id: input.metaPageId,
        link_data: {
          link,
          message: assets.primaryTexts[0],
          name: assets.headlines[0],
          description: assets.description,
          call_to_action: { type: assets.callToAction, value: { link } },
        },
      }),
    })
    if (!creativeRes.ok) {
      warnings.push(`Creative failed: ${creativeRes.error}`)
      return {
        ok: true,
        data: {
          platformCampaignId: campaignId, name, adGroupId: adSetId,
          keywordCount: 0, negativeKeywordCount: 0, adCount: 0,
          status: input.goLive ? "active" : "paused", warnings,
        },
        error: null,
        provenance: this.provenance,
      }
    }

    const adRes = await this.request<{ id?: string }>(`/${act}/ads`, "POST", {
      name: `${input.model} — ${input.objective}`,
      adset_id: adSetId,
      creative: JSON.stringify({ creative_id: creativeRes.data!.id }),
      status: input.goLive ? "ACTIVE" : "PAUSED",
    })
    if (!adRes.ok) warnings.push(`Ad failed: ${adRes.error}`)

    return {
      ok: true,
      data: {
        platformCampaignId: campaignId,
        name,
        adGroupId: adSetId,
        keywordCount: 0,
        negativeKeywordCount: 0,
        adCount: adRes.ok ? 1 : 0,
        status: input.goLive ? "active" : "paused",
        warnings,
      },
      error: null,
      provenance: this.provenance,
    }
  }

  private async setStatus(
    campaignId: string,
    status: "PAUSED" | "ACTIVE",
  ): Promise<ProviderResult<null>> {
    if (!this.isConfigured()) return this.notConfigured<null>()
    const res = await this.request<unknown>(`/${campaignId}`, "POST", { status })
    return res.ok
      ? { ok: true, data: null, error: null, provenance: this.provenance }
      : this.fail<null>(res.error!)
  }

  async pauseCampaign(_accountId: string, campaignId: string) {
    return this.setStatus(campaignId, "PAUSED")
  }

  async resumeCampaign(_accountId: string, campaignId: string) {
    return this.setStatus(campaignId, "ACTIVE")
  }

  /**
   * Meta permits only 4 budget changes per ad set per hour. Callers must go
   * through the rate-limited apply queue rather than calling this directly in a
   * loop, or a burst of approvals will breach the ceiling.
   */
  async setDailyBudget(
    _accountId: string,
    campaignId: string,
    dailyBudget: number,
  ): Promise<ProviderResult<null>> {
    if (!this.isConfigured()) return this.notConfigured<null>()
    const res = await this.request<unknown>(`/${campaignId}`, "POST", {
      daily_budget: toMinor(dailyBudget),
    })
    return res.ok
      ? { ok: true, data: null, error: null, provenance: this.provenance }
      : this.fail<null>(res.error!)
  }

  async fetchMetrics(
    accountId: string,
    from: string,
    to: string,
  ): Promise<ProviderResult<MetricsRow[]>> {
    if (!this.isConfigured()) return this.notConfigured<MetricsRow[]>()
    const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`

    const res = await this.request<{
      data?: {
        campaign_id?: string
        date_start?: string
        spend?: string
        impressions?: string
        clicks?: string
        actions?: { action_type: string; value: string }[]
      }[]
    }>(`/${act}/insights`, "GET", {
      level: "campaign",
      time_increment: "1",
      time_range: JSON.stringify({ since: from, until: to }),
      fields: "campaign_id,spend,impressions,clicks,actions",
      limit: "500",
    })
    if (!res.ok) return this.fail<MetricsRow[]>(res.error!)

    const rows: MetricsRow[] = (res.data?.data ?? []).map((r) => ({
      campaignId: r.campaign_id ?? "",
      date: r.date_start ?? "",
      spend: Number(r.spend ?? 0),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      leads: Number(
        r.actions?.find((a) =>
          ["lead", "onsite_conversion.lead_grouped"].includes(a.action_type),
        )?.value ?? 0,
      ),
    }))

    return { ok: true, data: rows, error: null, provenance: this.provenance }
  }
}
