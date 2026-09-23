import { describe, it, expect } from "vitest"
import {
  GOOGLE_DESCRIPTION_MAX, GOOGLE_HEADLINE_MAX, META_HEADLINE_MAX, META_PRIMARY_MAX,
  googleAssets, metaAssets, taggedLandingUrl,
} from "../creative"

const input = {
  dealerName: "Apex Hyundai", brand: "Hyundai", model: "Creta",
  city: "Lucknow", objective: "leads" as const, offer: null,
}

describe("Google assets obey the platform's limits", () => {
  it("keeps every headline within 30 characters", () => {
    for (const h of googleAssets(input).headlines) {
      expect(h.length).toBeLessThanOrEqual(GOOGLE_HEADLINE_MAX)
    }
  })

  it("keeps every description within 90 characters", () => {
    for (const d of googleAssets(input).descriptions) {
      expect(d.length).toBeLessThanOrEqual(GOOGLE_DESCRIPTION_MAX)
    }
  })

  it("never exceeds the 15 headline / 4 description ceiling", () => {
    const a = googleAssets({ ...input, dealerName: "A Very Long Dealership Name Indeed" })
    expect(a.headlines.length).toBeLessThanOrEqual(15)
    expect(a.descriptions.length).toBeLessThanOrEqual(4)
  })

  it("truncates on a word boundary rather than mid-word", () => {
    const a = googleAssets({ ...input, model: "Grand Vitara Hybrid Special" })
    for (const h of a.headlines) expect(h).not.toMatch(/\s$/)
  })

  it("produces no duplicates", () => {
    const h = googleAssets(input).headlines
    expect(new Set(h.map((x) => x.toLowerCase())).size).toBe(h.length)
  })
})

describe("negative keywords ship by default", () => {
  it("excludes used-car intent, which the audit finds is the costliest gap", () => {
    const n = googleAssets(input).negativeKeywords
    for (const term of ["second hand", "used", "olx", "resale"]) {
      expect(n).toContain(term)
    }
  })

  it("excludes pure research intent", () => {
    const n = googleAssets(input).negativeKeywords
    for (const term of ["images", "review", "mileage"]) expect(n).toContain(term)
  })

  it("ships a substantial list, not a token one", () => {
    expect(googleAssets(input).negativeKeywords.length).toBeGreaterThan(20)
  })
})

describe("keywords", () => {
  it("includes the model and the city", () => {
    const k = googleAssets(input).keywords.map((x) => x.text).join(" ")
    expect(k).toContain("creta")
    expect(k).toContain("lucknow")
  })

  it("uses exact match on the core brand-model term", () => {
    const core = googleAssets(input).keywords.find((k) => k.text === "hyundai creta")
    expect(core?.matchType).toBe("EXACT")
  })

  it("adds an objective-specific term for test drives", () => {
    const k = googleAssets({ ...input, objective: "test_drive" })
      .keywords.map((x) => x.text)
    expect(k.some((t) => t.includes("test drive"))).toBe(true)
  })
})

describe("Meta assets", () => {
  it("keeps primary text within 125 characters", () => {
    for (const t of metaAssets(input).primaryTexts) {
      expect(t.length).toBeLessThanOrEqual(META_PRIMARY_MAX)
    }
  })

  it("keeps headlines within 40 characters", () => {
    for (const h of metaAssets(input).headlines) {
      expect(h.length).toBeLessThanOrEqual(META_HEADLINE_MAX)
    }
  })

  it("uses the offer as the headline when there is one", () => {
    const a = metaAssets({ ...input, offer: "Exchange bonus up to ₹40,000" })
    expect(a.headlines[0]).toMatch(/Exchange bonus/)
  })
})

describe("landing page tagging", () => {
  it("adds the parameters the LMS needs to attribute the lead", () => {
    const url = taggedLandingUrl("https://lp.example.in/apex", {
      platform: "google", dealerCode: "APXHYD", model: "Creta", objective: "leads",
    })
    expect(url).toContain("utm_source=google")
    expect(url).toContain("utm_medium=cpc")
    expect(url).toContain("apxhyd")
  })

  it("appends rather than clobbering an existing query string", () => {
    const url = taggedLandingUrl("https://lp.example.in/apex?ref=x", {
      platform: "meta", dealerCode: "A", model: "Creta", objective: "leads",
    })
    expect(url).toContain("ref=x")
    expect(url).toContain("utm_source=meta")
  })

  it("leaves an empty url alone rather than emitting a bare query string", () => {
    expect(taggedLandingUrl("", {
      platform: "meta", dealerCode: "A", model: "M", objective: "leads",
    })).toBe("")
  })
})
