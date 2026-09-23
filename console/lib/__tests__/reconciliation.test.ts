import { describe, it, expect } from "vitest"
import { reconcile, reconciliationSummary } from "../reconciliation"
import type { Lead, MetricsDaily } from "../types"

const DATE = "2026-09-20"

function metric(platform: "google" | "meta", leads: number, spend = 10_000): MetricsDaily {
  return {
    id: `m_${platform}`, dealerId: "d1", campaignId: "c1", platform, date: DATE,
    spend, impressions: 10_000, clicks: 400, leads, provenance: "simulated",
  }
}

function lead(
  platform: "google" | "meta",
  source: Lead["source"] = "landing_page",
  n = 0,
): Lead {
  return {
    id: `l_${platform}_${source}_${n}`, dealerId: "d1", campaignId: "c1", platform,
    source, platformLeadId: null, lmsRef: null, name: "Test Person",
    phone: "+91 80000 00000", email: null, model: "Creta", city: "Lucknow",
    status: "new", notes: null, receivedAt: `${DATE}T10:00:00.000Z`,
    provenance: "simulated",
  }
}

const many = (n: number, f: (i: number) => Lead) => Array.from({ length: n }, (_, i) => f(i))

describe("gap direction", () => {
  it("calls it aligned when the counts agree", () => {
    const rows = reconcile(many(10, (i) => lead("google", "landing_page", i)), [metric("google", 10)])
    expect(rows[0].verdict).toBe("aligned")
    expect(rows[0].gap).toBe(0)
  })

  it("tolerates small noise rather than crying wolf", () => {
    const rows = reconcile(many(19, (i) => lead("google", "landing_page", i)), [metric("google", 20)])
    expect(rows[0].verdict).toBe("aligned")
  })

  it("attributes a surplus to phone calls when calls cover it", () => {
    const rows = reconcile(
      [...many(10, (i) => lead("meta", "landing_page", i)),
       ...many(5, (i) => lead("meta", "call", i))],
      [metric("meta", 10)],
    )
    expect(rows[0].verdict).toBe("calls_uncounted")
    expect(rows[0].callLeads).toBe(5)
  })

  it("flags a tracking gap when the platform counted more than we hold", () => {
    const rows = reconcile(many(6, (i) => lead("google", "landing_page", i)), [metric("google", 20)])
    expect(rows[0].verdict).toBe("tracking_gap")
    expect(rows[0].gap).toBeLessThan(0)
  })

  it("flags leads the platform has no record of at all", () => {
    const rows = reconcile(many(8, (i) => lead("meta", "call", i)), [metric("meta", 0)])
    expect(rows[0].verdict).toBe("no_platform_data")
  })

  it("reports nothing to reconcile when both are empty", () => {
    expect(reconcile([], [metric("google", 0)])[0].verdict).toBe("no_leads")
  })
})

describe("the two CPLs", () => {
  it("shows a higher CPL on evidenced leads when we captured fewer", () => {
    const rows = reconcile(
      many(5, (i) => lead("google", "landing_page", i)),
      [metric("google", 10, 10_000)],
    )
    expect(rows[0].platformCpl).toBe(1000)
    expect(rows[0].capturedCpl).toBe(2000)
    // The defensible number is the worse one — that is the point.
    expect(rows[0].capturedCpl!).toBeGreaterThan(rows[0].platformCpl!)
  })

  it("returns null rather than dividing by zero", () => {
    const rows = reconcile([], [metric("google", 0)])
    expect(rows[0].platformCpl).toBeNull()
    expect(rows[0].capturedCpl).toBeNull()
  })
})

describe("explanations", () => {
  it("names the call count when explaining a surplus", () => {
    const rows = reconcile(
      [...many(10, (i) => lead("meta", "landing_page", i)),
       ...many(6, (i) => lead("meta", "call", i))],
      [metric("meta", 10)],
    )
    expect(rows[0].explanation).toMatch(/6 of them came in by phone/)
  })

  it("warns before a tracking-gap CPL is quoted to a dealer", () => {
    const rows = reconcile(many(6, (i) => lead("google", "landing_page", i)), [metric("google", 20)])
    expect(rows[0].explanation).toMatch(/before this CPL is quoted/i)
  })

  it("never emits undefined or NaN into dealer-facing text", () => {
    const rows = reconcile(many(3, (i) => lead("google", "call", i)), [metric("google", 0, 0)])
    for (const r of rows) expect(r.explanation).not.toMatch(/undefined|NaN/)
  })
})

describe("ordering and summary", () => {
  it("puts the worst disagreement first", () => {
    const rows = reconcile(
      [...many(10, (i) => lead("google", "landing_page", i)),
       ...many(2, (i) => lead("meta", "landing_page", i))],
      [metric("google", 10), metric("meta", 20)],
    )
    expect(rows[0].platform).toBe("meta")
  })

  it("counts only the rows that actually need attention", () => {
    const rows = reconcile(
      [...many(10, (i) => lead("google", "landing_page", i)),
       ...many(2, (i) => lead("meta", "landing_page", i))],
      [metric("google", 10), metric("meta", 20)],
    )
    const s = reconciliationSummary(rows)
    expect(s.needsAttention).toBe(1)
    expect(s.capturedLeads).toBe(12)
    expect(s.platformLeads).toBe(30)
  })
})
