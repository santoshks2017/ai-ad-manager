import { describe, it, expect } from "vitest"
import { auditHeadline, runAudit, type AuditInput } from "../audit"

const NOW = new Date("2026-09-23T00:00:00Z")

/** A healthy account: nothing should fire. */
function clean(over: Partial<AuditInput> = {}): AuditInput {
  return {
    dealerId: "d1", googleCustomerId: "123-456-7890", periodDays: 30,
    spend: 100_000, leads: 250, clicks: 2000, impressions: 60_000,
    campaignCount: 3, adGroupCount: 12, negativeKeywordCount: 120,
    broadMatchSpendShare: 0.1, conversionTrackingConfigured: true,
    locationTargetingConfigured: true, zeroConversionSearchTermSpend: 2000,
    weakAdCount: 1, totalAdCount: 9, monthlyBudget: 100_000,
    provenance: "simulated", ...over,
  }
}

describe("a well-run account", () => {
  it("produces no findings", () => {
    expect(runAudit(clean(), NOW).findings).toHaveLength(0)
  })

  it("says so plainly rather than inventing a problem", () => {
    const a = runAudit(clean(), NOW)
    expect(auditHeadline(a)).toMatch(/well structured/i)
    expect(a.totalEstimatedWaste).toBe(0)
  })
})

describe("individual checks", () => {
  it("flags a total absence of negative keywords as high severity", () => {
    const a = runAudit(clean({ negativeKeywordCount: 0 }), NOW)
    const f = a.findings.find((x) => x.check === "no_negative_keywords")!
    expect(f.severity).toBe("high")
    expect(f.confidence).toBe("high")
  })

  it("treats a thin negative list as medium, not high", () => {
    const f = runAudit(clean({ negativeKeywordCount: 8 }), NOW)
      .findings.find((x) => x.check === "no_negative_keywords")!
    expect(f.severity).toBe("medium")
  })

  it("flags missing conversion tracking and explains why it matters", () => {
    const f = runAudit(clean({ conversionTrackingConfigured: false }), NOW)
      .findings.find((x) => x.check === "no_conversion_tracking")!
    expect(f.severity).toBe("high")
    expect(f.finding).toMatch(/optimising toward clicks/i)
  })

  it("flags missing location targeting", () => {
    const a = runAudit(clean({ locationTargetingConfigured: false }), NOW)
    expect(a.findings.some((f) => f.check === "no_location_targeting")).toBe(true)
  })

  it("names the measured rupee figure for zero-conversion search terms", () => {
    const f = runAudit(clean({ zeroConversionSearchTermSpend: 30_000 }), NOW)
      .findings.find((x) => x.check === "irrelevant_search_terms")!
    expect(f.confidence).toBe("high")
    expect(f.finding).toMatch(/₹30,000/)
  })

  it("ignores a small share of non-converting terms as normal", () => {
    const a = runAudit(clean({ zeroConversionSearchTermSpend: 3000 }), NOW)
    expect(a.findings.some((f) => f.check === "irrelevant_search_terms")).toBe(false)
  })

  it("does not flag broad match when negatives and tracking already control it", () => {
    const a = runAudit(
      clean({ broadMatchSpendShare: 0.6, negativeKeywordCount: 80 }), NOW,
    )
    expect(a.findings.some((f) => f.check === "broad_match_waste")).toBe(false)
  })

  it("flags broad match when nothing is controlling it", () => {
    const a = runAudit(
      clean({ broadMatchSpendShare: 0.6, negativeKeywordCount: 5 }), NOW,
    )
    expect(a.findings.some((f) => f.check === "broad_match_waste")).toBe(true)
  })

  it("flags everything crammed into one ad group", () => {
    const a = runAudit(clean({ campaignCount: 2, adGroupCount: 2 }), NOW)
    expect(a.findings.some((f) => f.check === "single_ad_group")).toBe(true)
  })
})

describe("under-delivery", () => {
  it("is reported, because unspent budget buys nothing", () => {
    const a = runAudit(clean({ spend: 35_000, monthlyBudget: 100_000 }), NOW)
    const f = a.findings.find((x) => x.check === "budget_underpacing")!
    expect(f.severity).toBe("high")
  })

  it("carries no waste figure — the money is not lost, the opportunity is", () => {
    const f = runAudit(clean({ spend: 35_000, monthlyBudget: 100_000 }), NOW)
      .findings.find((x) => x.check === "budget_underpacing")!
    expect(f.estimatedMonthlyWaste).toBe(0)
  })
})

describe("the headline waste figure", () => {
  it("is capped so overlapping findings cannot inflate it", () => {
    // Every rule fires; naive addition would exceed total spend.
    const a = runAudit(
      clean({
        negativeKeywordCount: 0, conversionTrackingConfigured: false,
        locationTargetingConfigured: false, broadMatchSpendShare: 0.9,
        zeroConversionSearchTermSpend: 60_000, campaignCount: 1,
        adGroupCount: 1, weakAdCount: 9, totalAdCount: 9,
      }), NOW,
    )
    const naive = a.findings.reduce((s, f) => s + f.estimatedMonthlyWaste, 0)
    expect(naive).toBeGreaterThan(a.totalEstimatedWaste)
    expect(a.wastePercent).toBeLessThanOrEqual(0.45)
  })

  it("never exceeds what the account actually spends", () => {
    const a = runAudit(
      clean({
        negativeKeywordCount: 0, conversionTrackingConfigured: false,
        locationTargetingConfigured: false, zeroConversionSearchTermSpend: 90_000,
      }), NOW,
    )
    expect(a.totalEstimatedWaste).toBeLessThan(a.observedSpend)
  })

  it("scales a non-30-day window to a monthly figure", () => {
    const week = runAudit(
      clean({ periodDays: 7, spend: 25_000, negativeKeywordCount: 0 }), NOW,
    )
    // A week at 25k is roughly 107k monthly, so waste should reflect the month.
    expect(week.totalEstimatedWaste).toBeGreaterThan(10_000)
  })
})

describe("ordering and reporting", () => {
  it("puts the most serious findings first", () => {
    const a = runAudit(
      clean({
        negativeKeywordCount: 0, conversionTrackingConfigured: false,
        weakAdCount: 9, totalAdCount: 9,
      }), NOW,
    )
    const rank = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < a.findings.length; i++) {
      expect(rank[a.findings[i - 1].severity]).toBeLessThanOrEqual(
        rank[a.findings[i].severity],
      )
    }
  })

  it("records the observed CPL, which is what calibrates the quote engine", () => {
    const a = runAudit(clean({ spend: 100_000, leads: 250 }), NOW)
    expect(a.observedCpl).toBe(400)
  })

  it("returns a null CPL rather than dividing by zero", () => {
    expect(runAudit(clean({ leads: 0 }), NOW).observedCpl).toBeNull()
  })

  it("writes a headline a salesperson can open with", () => {
    const a = runAudit(clean({ negativeKeywordCount: 0 }), NOW)
    const h = auditHeadline(a)
    expect(h).toMatch(/₹/)
    expect(h).not.toMatch(/undefined|NaN/)
  })

  it("carries provenance so a simulated audit cannot pass for a real one", () => {
    expect(runAudit(clean(), NOW).provenance).toBe("simulated")
  })
})
