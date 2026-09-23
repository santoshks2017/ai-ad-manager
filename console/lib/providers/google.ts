/**
 * Google Ads provider.
 *
 * ⚠️ UNVERIFIED. This is written against the documented REST API but has never
 * been executed against a real endpoint, because no developer token exists yet.
 * Treat every call path here as untested until it has run against a live
 * account. `isConfigured()` returns false without credentials, so the app falls
 * back to the simulator rather than failing at call time.
 *
 * Account model: one Google Ads client account per dealer, all under our MCC.
 * This is not a preference — Google's third-party policy states "we require
 * that you use a separate account for each end-advertiser that you manage".
 * `loginCustomerId` is the MCC; `accountId` is the dealer's client account.
 *
 * Access levels: Basic allows 15,000 operations/day, Standard is unlimited and
 * needs a manual audit. Because this is an internal agency tool with no
 * third-party access, Required Minimum Functionality does not apply — RMF
 * exempts "internal use only" tools.
 */

import { googleAssets, taggedLandingUrl } from "../creative"
import type { Platform } from "../types"
import {
  campaignName,
  type AdProvider,
  type BuiltCampaign,
  type CreateCampaignInput,
  type MetricsRow,
  type ProviderResult,
} from "./types"

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v21"
const BASE = `https://googleads.googleapis.com/${API_VERSION}`

/** Google Ads money fields are micros: 1 rupee = 1,000,000 micros. */
const toMicros = (inr: number) => Math.round(inr * 1_000_000)
const fromMicros = (micros: number) => micros / 1_000_000

export class GoogleAdsProvider implements AdProvider {
  readonly platform: Platform = "google"
  readonly provenance = "live" as const

  private developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  private loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
  private accessToken = process.env.GOOGLE_ADS_ACCESS_TOKEN

  isConfigured(): boolean {
    return Boolean(this.developerToken && this.loginCustomerId && this.accessToken)
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "developer-token": this.developerToken!,
      "login-customer-id": this.loginCustomerId!.replace(/-/g, ""),
      "Content-Type": "application/json",
    }
  }

  private fail<T>(error: string): ProviderResult<T> {
    return { ok: false, data: null, error, provenance: this.provenance }
  }

  private notConfigured<T>(): ProviderResult<T> {
    return this.fail<T>(
      "Google Ads is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, " +
        "GOOGLE_ADS_LOGIN_CUSTOMER_ID and GOOGLE_ADS_ACCESS_TOKEN.",
    )
  }

  private async post<T>(path: string, body: unknown): Promise<ProviderResult<T>> {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (!res.ok) {
        return this.fail<T>(`Google Ads API ${res.status}: ${text.slice(0, 400)}`)
      }
      return {
        ok: true,
        data: (text ? JSON.parse(text) : null) as T,
        error: null,
        provenance: this.provenance,
      }
    } catch (err) {
      return this.fail<T>(`Google Ads request failed: ${(err as Error).message}`)
    }
  }

  /**
   * Build the whole campaign: budget, campaign, location targeting, ad group,
   * keywords, negative keywords and a responsive search ad.
   *
   * Ordering matters — each step needs the resource name from the one before,
   * so this cannot be parallelised. If a later step fails the campaign is left
   * in place and the failure is returned as a warning rather than silently
   * swallowed: a half-built campaign someone can finish beats a deleted one
   * nobody knows about.
   *
   * Created paused unless `goLive` is set. Spend cannot be unwound.
   */
  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
  ): Promise<ProviderResult<BuiltCampaign>> {
    if (!this.isConfigured()) return this.notConfigured<BuiltCampaign>()

    const customerId = accountId.replace(/-/g, "")
    const name = campaignName(input)
    const warnings: string[] = []
    const assets = googleAssets({
      dealerName: input.dealerName,
      brand: input.brand,
      model: input.model,
      city: input.city,
      objective: input.objective,
      offer: input.offer,
    })

    const budgetRes = await this.post<{ results?: { resourceName: string }[] }>(
      `/customers/${customerId}/campaignBudgets:mutate`,
      {
        operations: [
          {
            create: {
              name: `${name}__budget`,
              amountMicros: String(toMicros(input.dailyBudget)),
              deliveryMethod: "STANDARD",
              explicitlyShared: false,
            },
          },
        ],
      },
    )
    if (!budgetRes.ok) return this.fail<BuiltCampaign>(budgetRes.error!)
    const budgetResource = budgetRes.data?.results?.[0]?.resourceName
    if (!budgetResource) {
      return this.fail<BuiltCampaign>("Google Ads returned no budget resource name.")
    }

    const campaignRes = await this.post<{ results?: { resourceName: string }[] }>(
      `/customers/${customerId}/campaigns:mutate`,
      {
        operations: [
          {
            create: {
              name,
              status: input.goLive ? "ENABLED" : "PAUSED",
              advertisingChannelType: "SEARCH",
              campaignBudget: budgetResource,
              maximizeConversions: {},
              networkSettings: {
                targetGoogleSearch: true,
                targetSearchNetwork: true,
                targetContentNetwork: false,
                targetPartnerSearchNetwork: false,
              },
              // Only show to people actually in the area, not people merely
              // searching about it — a dealer cannot sell to the latter.
              geoTargetTypeSetting: {
                positiveGeoTargetType: "PRESENCE",
                negativeGeoTargetType: "PRESENCE",
              },
              startDate: input.startDate.replace(/-/g, ""),
              ...(input.endDate ? { endDate: input.endDate.replace(/-/g, "") } : {}),
            },
          },
        ],
      },
    )
    if (!campaignRes.ok) return this.fail<BuiltCampaign>(campaignRes.error!)
    const campaignResource = campaignRes.data?.results?.[0]?.resourceName
    if (!campaignResource) {
      return this.fail<BuiltCampaign>("Google Ads returned no campaign resource name.")
    }
    const campaignId = campaignResource.split("/").pop()!

    // Radius around the showroom, plus the negative keyword list. Both are
    // campaign-level criteria so they go in one mutate.
    const criteria: unknown[] = [
      {
        create: {
          campaign: campaignResource,
          proximity: {
            radius: input.radiusKm,
            radiusUnits: "KILOMETERS",
            address: { cityName: input.city, countryCode: "IN" },
          },
        },
      },
      ...assets.negativeKeywords.map((text) => ({
        create: {
          campaign: campaignResource,
          negative: true,
          keyword: { text, matchType: "PHRASE" },
        },
      })),
    ]
    const criteriaRes = await this.post<unknown>(
      `/customers/${customerId}/campaignCriteria:mutate`,
      { operations: criteria },
    )
    if (!criteriaRes.ok) {
      warnings.push(`Targeting and negative keywords failed: ${criteriaRes.error}`)
    }

    const adGroupRes = await this.post<{ results?: { resourceName: string }[] }>(
      `/customers/${customerId}/adGroups:mutate`,
      {
        operations: [
          {
            create: {
              name: `${input.model} — ${input.objective}`,
              campaign: campaignResource,
              status: input.goLive ? "ENABLED" : "PAUSED",
              type: "SEARCH_STANDARD",
            },
          },
        ],
      },
    )
    if (!adGroupRes.ok) {
      return {
        ok: true,
        data: {
          platformCampaignId: campaignId, name, adGroupId: null,
          keywordCount: 0, negativeKeywordCount: assets.negativeKeywords.length,
          adCount: 0, status: input.goLive ? "active" : "paused",
          warnings: [...warnings, `Ad group failed: ${adGroupRes.error}`],
        },
        error: null,
        provenance: this.provenance,
      }
    }
    const adGroupResource = adGroupRes.data!.results![0].resourceName
    const adGroupId = adGroupResource.split("/").pop()!

    const keywordRes = await this.post<unknown>(
      `/customers/${customerId}/adGroupCriteria:mutate`,
      {
        operations: assets.keywords.map((k) => ({
          create: {
            adGroup: adGroupResource,
            status: "ENABLED",
            keyword: { text: k.text, matchType: k.matchType },
          },
        })),
      },
    )
    if (!keywordRes.ok) warnings.push(`Keywords failed: ${keywordRes.error}`)

    const finalUrl = taggedLandingUrl(input.landingPageUrl, {
      platform: "google",
      dealerCode: input.dealerCode,
      model: input.model,
      objective: input.objective,
    })

    const adRes = await this.post<unknown>(
      `/customers/${customerId}/adGroupAds:mutate`,
      {
        operations: [
          {
            create: {
              adGroup: adGroupResource,
              status: input.goLive ? "ENABLED" : "PAUSED",
              ad: {
                finalUrls: [finalUrl],
                responsiveSearchAd: {
                  headlines: assets.headlines.map((text) => ({ text })),
                  descriptions: assets.descriptions.map((text) => ({ text })),
                  path1: assets.path1,
                  path2: assets.path2,
                },
              },
            },
          },
        ],
      },
    )
    if (!adRes.ok) warnings.push(`Ad creation failed: ${adRes.error}`)

    return {
      ok: true,
      data: {
        platformCampaignId: campaignId,
        name,
        adGroupId,
        keywordCount: keywordRes.ok ? assets.keywords.length : 0,
        negativeKeywordCount: criteriaRes.ok ? assets.negativeKeywords.length : 0,
        adCount: adRes.ok ? 1 : 0,
        status: input.goLive ? "active" : "paused",
        warnings,
      },
      error: null,
      provenance: this.provenance,
    }
  }

  private async setStatus(
    accountId: string,
    campaignId: string,
    status: "PAUSED" | "ENABLED",
  ): Promise<ProviderResult<null>> {
    if (!this.isConfigured()) return this.notConfigured<null>()
    const customerId = accountId.replace(/-/g, "")
    const res = await this.post<unknown>(`/customers/${customerId}/campaigns:mutate`, {
      operations: [
        {
          update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status },
          updateMask: "status",
        },
      ],
    })
    return res.ok
      ? { ok: true, data: null, error: null, provenance: this.provenance }
      : this.fail<null>(res.error!)
  }

  async pauseCampaign(accountId: string, campaignId: string) {
    return this.setStatus(accountId, campaignId, "PAUSED")
  }

  async resumeCampaign(accountId: string, campaignId: string) {
    return this.setStatus(accountId, campaignId, "ENABLED")
  }

  async setDailyBudget(
    accountId: string,
    campaignId: string,
    dailyBudget: number,
  ): Promise<ProviderResult<null>> {
    if (!this.isConfigured()) return this.notConfigured<null>()
    const customerId = accountId.replace(/-/g, "")

    // The budget resource is reached through the campaign, so look it up first.
    const lookup = await this.post<{ results?: { campaign?: { campaignBudget?: string } }[] }>(
      `/customers/${customerId}/googleAds:search`,
      {
        query:
          `SELECT campaign.campaign_budget FROM campaign ` +
          `WHERE campaign.id = ${Number(campaignId)}`,
      },
    )
    if (!lookup.ok) return this.fail<null>(lookup.error!)

    const budgetResource = lookup.data?.results?.[0]?.campaign?.campaignBudget
    if (!budgetResource) return this.fail<null>("Could not resolve the campaign's budget.")

    const res = await this.post<unknown>(`/customers/${customerId}/campaignBudgets:mutate`, {
      operations: [
        {
          update: {
            resourceName: budgetResource,
            amountMicros: String(toMicros(dailyBudget)),
          },
          updateMask: "amount_micros",
        },
      ],
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
    const customerId = accountId.replace(/-/g, "")

    const res = await this.post<
      {
        results?: {
          campaign?: { id?: string }
          segments?: { date?: string }
          metrics?: {
            costMicros?: string
            impressions?: string
            clicks?: string
            conversions?: number
          }
        }[]
      }
    >(`/customers/${customerId}/googleAds:search`, {
      query:
        `SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, ` +
        `metrics.clicks, metrics.conversions FROM campaign ` +
        `WHERE segments.date BETWEEN '${from}' AND '${to}'`,
      pageSize: 10000,
    })
    if (!res.ok) return this.fail<MetricsRow[]>(res.error!)

    const rows: MetricsRow[] = (res.data?.results ?? []).map((r) => ({
      campaignId: r.campaign?.id ?? "",
      date: r.segments?.date ?? "",
      spend: fromMicros(Number(r.metrics?.costMicros ?? 0)),
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks: Number(r.metrics?.clicks ?? 0),
      leads: Math.round(r.metrics?.conversions ?? 0),
    }))

    return { ok: true, data: rows, error: null, provenance: this.provenance }
  }
}

/**
 * Link a showroom's Google Business Profile so its locations become assets.
 *
 * Location assets are what let an ad show an address, a directions link and a
 * call button, and they are a precondition for store-visit measurement. For a
 * business people physically drive to, running without them leaves real
 * performance on the table.
 *
 * Attached at the CUSTOMER level deliberately: Google inherits location assets
 * down to every campaign from there, so there is nothing to attach per
 * campaign and nothing to forget when the next one is built.
 *
 * ⚠️ UNVERIFIED like the rest of this provider. The nested field names under
 * `location_set` in particular are the kind of detail that is easy to get
 * subtly wrong from documentation alone — check against the generated client
 * for the API version in use before relying on this.
 */
export async function linkBusinessProfile(
  provider: GoogleAdsProvider,
  accountId: string,
  opts: {
    /** OAuth token from the SHOWROOM's Google account, scope business.manage. */
    businessProfileToken: string
    businessProfileEmail: string
    businessAccountId?: string | null
  },
): Promise<ProviderResult<{ assetSetResource: string }>> {
  if (!provider.isConfigured()) {
    return {
      ok: false, data: null, provenance: "live",
      error: "Google Ads is not configured.",
    }
  }

  const customerId = accountId.replace(/-/g, "")
  const post = (provider as unknown as {
    post: <T>(path: string, body: unknown) => Promise<ProviderResult<T>>
  }).post.bind(provider)

  const assetSetRes = await post<{ results?: { resourceName: string }[] }>(
    `/customers/${customerId}/assetSets:mutate`,
    {
      operations: [
        {
          create: {
            name: `business-profile-${opts.businessProfileEmail}`,
            type: "LOCATION_SYNC",
            locationSet: {
              // The showroom owns its own profile; we are a manager on it.
              locationOwnershipType: "BUSINESS_OWNER",
              businessProfileLocationSet: {
                httpAuthorizationToken: opts.businessProfileToken,
                emailAddress: opts.businessProfileEmail,
                ...(opts.businessAccountId
                  ? { businessAccountId: opts.businessAccountId }
                  : {}),
              },
            },
          },
        },
      ],
    },
  )
  if (!assetSetRes.ok) {
    return { ok: false, data: null, error: assetSetRes.error, provenance: "live" }
  }

  const assetSetResource = assetSetRes.data?.results?.[0]?.resourceName
  if (!assetSetResource) {
    return {
      ok: false, data: null, provenance: "live",
      error: "Google Ads returned no asset set resource name.",
    }
  }

  const linkRes = await post<unknown>(
    `/customers/${customerId}/customerAssetSets:mutate`,
    { operations: [{ create: { assetSet: assetSetResource } }] },
  )
  if (!linkRes.ok) {
    return { ok: false, data: null, error: linkRes.error, provenance: "live" }
  }

  return {
    ok: true,
    data: { assetSetResource },
    error: null,
    provenance: "live",
  }
}
