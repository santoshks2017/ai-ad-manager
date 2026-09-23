import { describe, it, expect } from "vitest"
import { campaignReadiness } from "../campaign-readiness"
import { CAMPAIGN_TYPES } from "../types"
import type { Dealer, ImageAsset } from "../types"

function dealer(over: Partial<Dealer> = {}): Dealer {
  return {
    id: "d1", code: "TST", name: "Test Motors", city: "Lucknow", state: "UP",
    brands: ["Hyundai"], models: ["Creta"], monthlyBudget: 100_000,
    committedCpl: 400, virtualNumber: null,
    landingPageUrl: "https://lp.example.in/test", lmsAccountRef: null,
    status: "active", ownerId: null,
    platform: {
      googleCustomerId: "g", googleState: "ready", googleVerified: true,
      google: { ownership: "agency_owned", billing: "agency_billed", grant: "not_requested", lastVerifiedAt: null },
      metaBusinessId: "m", metaPageId: "p", metaAdAccountId: "a",
      metaState: "ready", metaVerified: true,
      meta: { ownership: "agency_owned", billing: "agency_billed", grant: "not_requested", lastVerifiedAt: null },
      googleBusinessProfileLinked: true, googleBusinessAccountEmail: null,
      servicesAgreementSigned: true, legalDocsCollected: true,
    },
    createdAt: "", updatedAt: "", ...over,
  }
}

const img = (role: ImageAsset["role"]): ImageAsset => ({
  id: `i_${role}`, dealerId: "d1", role, url: "https://x/i.jpg",
  widthPx: 1200, heightPx: 628, uploadedAt: "",
})

const fullSet = [img("landscape"), img("square"), img("logo")]

describe("Search", () => {
  it("is ready with no imagery at all — it is a text format", () => {
    expect(campaignReadiness("search", dealer(), []).ready).toBe(true)
  })

  it("does not need a landing page, because it can use a lead form", () => {
    const r = campaignReadiness("search", dealer({ landingPageUrl: null }), [])
    expect(r.ready).toBe(true)
  })
})

describe("Performance Max", () => {
  it("is blocked without imagery", () => {
    const r = campaignReadiness("performance_max", dealer(), [])
    expect(r.ready).toBe(false)
  })

  it("names the aspect ratio and size, so someone can go and get it", () => {
    const r = campaignReadiness("performance_max", dealer(), [])
    const text = r.problems.map((p) => p.message).join(" ")
    expect(text).toMatch(/1\.91:1/)
    expect(text).toMatch(/600×314/)
  })

  it("asks for the dealership's logo, not the manufacturer's", () => {
    const r = campaignReadiness("performance_max", dealer(), [img("landscape"), img("square")])
    expect(r.problems.some((p) => p.kind === "missing_logo")).toBe(true)
    expect(r.problems.find((p) => p.kind === "missing_logo")!.message)
      .toMatch(/not the manufacturer/i)
  })

  it("is ready once all three image roles are present", () => {
    expect(campaignReadiness("performance_max", dealer(), fullSet).ready).toBe(true)
  })

  it("warns about a missing Business Profile without blocking on it", () => {
    const d = dealer()
    d.platform.googleBusinessProfileLinked = false
    const r = campaignReadiness("performance_max", d, fullSet)
    expect(r.ready).toBe(true)
    const warn = r.problems.find((p) => p.kind === "no_business_profile")!
    expect(warn.blocking).toBe(false)
    expect(warn.message).toMatch(/store visits/i)
  })
})

describe("Demand Gen", () => {
  it("requires a landing page, because its lead form support is not dependable", () => {
    const r = campaignReadiness("demand_gen", dealer({ landingPageUrl: null }), fullSet)
    expect(r.ready).toBe(false)
    expect(r.problems.some((p) => p.kind === "missing_landing_page")).toBe(true)
  })

  it("is ready with imagery and a landing page", () => {
    expect(campaignReadiness("demand_gen", dealer(), fullSet).ready).toBe(true)
  })
})

describe("the type table itself", () => {
  it("only claims lead-form support where it is actually confirmed", () => {
    expect(CAMPAIGN_TYPES.search.supportsLeadForm).toBe(true)
    expect(CAMPAIGN_TYPES.performance_max.supportsLeadForm).toBe(true)
    // Sources conflict on Demand Gen and lead forms did not survive the Video
    // Action migration, so this stays false until proven against a live account.
    expect(CAMPAIGN_TYPES.demand_gen.supportsLeadForm).toBe(false)
  })

  it("carries the API channel type for each", () => {
    expect(CAMPAIGN_TYPES.search.channelType).toBe("SEARCH")
    expect(CAMPAIGN_TYPES.performance_max.channelType).toBe("PERFORMANCE_MAX")
    expect(CAMPAIGN_TYPES.demand_gen.channelType).toBe("DEMAND_GEN")
  })

  it("does not offer the retired types", () => {
    const ids = Object.keys(CAMPAIGN_TYPES)
    for (const dead of ["display", "video", "local", "vehicle"]) {
      expect(ids).not.toContain(dead)
    }
  })
})
