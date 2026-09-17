import { describe, it, expect } from "vitest"
import { SimulatedProvider } from "../providers/simulated"
import { GoogleAdsProvider } from "../providers/google"
import { MetaAdsProvider } from "../providers/meta"
import { getProvider, providerStatus } from "../providers"
import { campaignName } from "../providers/types"
import type { CreateCampaignInput } from "../providers/types"

const input: CreateCampaignInput = {
  dealerCode: "APXHYD", dealerName: "Apex Hyundai", brand: "Hyundai",
  model: "Creta", objective: "leads", dailyBudget: 3000, city: "Lucknow",
  radiusKm: 25, startDate: "2026-09-01", endDate: null,
  landingPageUrl: "https://lp.example.in/apex", virtualNumber: "+91 80000 00000",
  headline: "Creta from Apex Hyundai", description: "Book a test drive today.",
}

describe("campaign naming (the attribution mechanism)", () => {
  it("encodes dealer, brand, model, objective and month", () => {
    const name = campaignName(input, new Date("2026-09-18"))
    expect(name).toBe("APXHYD__Hyundai__Creta__leads__202609")
  })

  it("strips characters that would break platform name rules", () => {
    const name = campaignName(
      { ...input, brand: "Maruti Suzuki", model: "Grand Vitara!" },
      new Date("2026-09-18"),
    )
    expect(name).toBe("APXHYD__Maruti-Suzuki__Grand-Vitara__leads__202609")
  })

  it("keeps the dealer code first so campaigns sort by dealer", () => {
    expect(campaignName(input, new Date("2026-09-18")).startsWith("APXHYD")).toBe(true)
  })
})

describe("simulated provider", () => {
  const sim = new SimulatedProvider("meta")

  it("is always usable", () => {
    expect(sim.isConfigured()).toBe(true)
  })

  it("stamps every result as simulated", async () => {
    const res = await sim.createCampaign("act_1", input)
    expect(res.provenance).toBe("simulated")
  })

  it("marks its campaign ids as simulated so they cannot pass for real", async () => {
    const res = await sim.createCampaign("act_1", input)
    expect(res.data!.platformCampaignId).toMatch(/^sim-meta-/)
  })

  it("is deterministic — same inputs, same id", async () => {
    const a = await sim.createCampaign("act_1", input)
    const b = await sim.createCampaign("act_1", input)
    expect(a.data!.platformCampaignId).toBe(b.data!.platformCampaignId)
  })

  it("gives different accounts different ids", async () => {
    const a = await sim.createCampaign("act_1", input)
    const b = await sim.createCampaign("act_2", input)
    expect(a.data!.platformCampaignId).not.toBe(b.data!.platformCampaignId)
  })

  it("returns one metrics row per day in range", async () => {
    const res = await sim.fetchMetrics("act_1", "2026-09-01", "2026-09-07")
    expect(res.data).toHaveLength(7)
  })

  it("produces plausible delivery, not zeros or NaN", async () => {
    const res = await sim.fetchMetrics("act_1", "2026-09-01", "2026-09-07")
    for (const row of res.data!) {
      expect(row.spend).toBeGreaterThan(0)
      expect(row.impressions).toBeGreaterThan(row.clicks)
      expect(row.clicks).toBeGreaterThanOrEqual(row.leads)
      expect(Number.isNaN(row.spend)).toBe(false)
    }
  })

  it("prices a metro above a tier-2 city", async () => {
    const metro = await sim.fetchMetrics("a", "2026-09-01", "2026-09-30", {
      campaignId: "x", city: "Mumbai", model: "Creta", dailyBudget: 3000,
    })
    const tier2 = await sim.fetchMetrics("a", "2026-09-01", "2026-09-30", {
      campaignId: "x", city: "Kanpur", model: "Creta", dailyBudget: 3000,
    })
    const cpl = (rows: typeof metro.data) => {
      const t = rows!.reduce((s, r) => ({ spend: s.spend + r.spend, leads: s.leads + r.leads }),
        { spend: 0, leads: 0 })
      return t.spend / t.leads
    }
    expect(cpl(metro.data)).toBeGreaterThan(cpl(tier2.data))
  })
})

describe("live providers without credentials", () => {
  it("Google reports itself unconfigured rather than throwing", () => {
    expect(new GoogleAdsProvider().isConfigured()).toBe(false)
  })

  it("Meta reports itself unconfigured rather than throwing", () => {
    expect(new MetaAdsProvider().isConfigured()).toBe(false)
  })

  it("Google fails with a message naming what is missing", async () => {
    const res = await new GoogleAdsProvider().createCampaign("123-456-7890", input)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/GOOGLE_ADS_DEVELOPER_TOKEN/)
  })

  it("Meta fails with a message naming what is missing", async () => {
    const res = await new MetaAdsProvider().createCampaign("act_1", input)
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/META_ACCESS_TOKEN/)
  })

  it("never fabricates data on failure", async () => {
    const res = await new GoogleAdsProvider().createCampaign("123", input)
    expect(res.data).toBeNull()
  })
})

describe("provider selection", () => {
  it("falls back to the simulator when credentials are absent", () => {
    expect(getProvider("google").provenance).toBe("simulated")
    expect(getProvider("meta").provenance).toBe("simulated")
  })

  it("reports status for both platforms with a reason", () => {
    const status = providerStatus()
    expect(status).toHaveLength(2)
    for (const s of status) {
      expect(s.live).toBe(false)
      expect(s.reason.length).toBeGreaterThan(10)
    }
  })
})
