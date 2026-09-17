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

import type { Platform } from "../types"
import {
  campaignName,
  type AdProvider,
  type CampaignRef,
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
   * Creates a budget, then a paused campaign against it.
   *
   * Campaigns are created PAUSED on purpose. A campaign that goes live the
   * instant it is created can start spending before anyone has checked the
   * targeting, and unwinding spend is not possible.
   */
  async createCampaign(
    accountId: string,
    input: CreateCampaignInput,
  ): Promise<ProviderResult<CampaignRef>> {
    if (!this.isConfigured()) return this.notConfigured<CampaignRef>()

    const customerId = accountId.replace(/-/g, "")
    const name = campaignName(input)

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
    if (!budgetRes.ok) return this.fail<CampaignRef>(budgetRes.error!)

    const budgetResource = budgetRes.data?.results?.[0]?.resourceName
    if (!budgetResource) {
      return this.fail<CampaignRef>("Google Ads returned no budget resource name.")
    }

    const campaignRes = await this.post<{ results?: { resourceName: string }[] }>(
      `/customers/${customerId}/campaigns:mutate`,
      {
        operations: [
          {
            create: {
              name,
              status: "PAUSED",
              advertisingChannelType: "SEARCH",
              campaignBudget: budgetResource,
              // Lead generation: bid to acquisition cost, not clicks.
              maximizeConversions: {},
              networkSettings: {
                targetGoogleSearch: true,
                targetSearchNetwork: true,
                targetContentNetwork: false,
                targetPartnerSearchNetwork: false,
              },
              startDate: input.startDate.replace(/-/g, ""),
              ...(input.endDate ? { endDate: input.endDate.replace(/-/g, "") } : {}),
            },
          },
        ],
      },
    )
    if (!campaignRes.ok) return this.fail<CampaignRef>(campaignRes.error!)

    const resourceName = campaignRes.data?.results?.[0]?.resourceName
    if (!resourceName) {
      return this.fail<CampaignRef>("Google Ads returned no campaign resource name.")
    }

    return {
      ok: true,
      data: { platformCampaignId: resourceName.split("/").pop()!, name },
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
