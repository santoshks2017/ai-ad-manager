import { describe, it, expect } from "vitest"
import { buildReport } from "../reports"
import type { Campaign, Dealer, MetricsDaily, Optimization } from "../types"

const NOW = new Date("2026-09-23T00:00:00Z")
const day = (ago: number) =>
  new Date(NOW.getTime() - ago * 86_400_000).toISOString().slice(0, 10)

const dealer = {
  id: "d1", code: "TST", name: "Test Motors", city: "Lucknow",
  committedCpl: 400, models: ["Creta"], brands: ["Hyundai"],
} as Dealer

function campaign(id: string, name: string): Campaign {
  return {
    id, dealerId: "d1", platform: "google", platformCampaignId: id, name,
    objective: "leads", dailyBudget: 1000, status: "active",
    provenance: "simulated", createdBy: "u", createdAt: "",
  }
}

function m(campaignId: string, ago: number, spend: number, leads: number): MetricsDaily {
  return {
    id: `${campaignId}_${ago}`, dealerId: "d1", campaignId, platform: "google",
    date: day(ago), spend, impressions: 1000, clicks: 50, leads,
    provenance: "simulated",
  }
}

/** Current week is days 1-7 ago; previous week is 8-14. */
const currentWeek = [1, 2, 3, 4, 5, 6, 7]
const priorWeek = [8, 9, 10, 11, 12, 13, 14]

describe("period comparison", () => {
  it("compares against the week immediately before", () => {
    const metrics = [
      ...currentWeek.map((d) => m("c1", d, 1000, 4)),   // CPL 250
      ...priorWeek.map((d) => m("c1", d, 1000, 2)),     // CPL 500
    ]
    const r = buildReport(dealer, [campaign("c1", "Creta Search")], metrics, [], "week", NOW)
    expect(r.cpl).toBe(250)
    expect(r.previousCpl).toBe(500)
    expect(r.cplChange).toBeCloseTo(-0.5, 5)
  })

  it("does not let the two windows overlap", () => {
    const metrics = currentWeek.map((d) => m("c1", d, 1000, 4))
    const r = buildReport(dealer, [campaign("c1", "X")], metrics, [], "week", NOW)
    expect(r.previousLeads).toBe(0)
  })
})

describe("the insight line", () => {
  it("compares delivered CPL against what was committed", () => {
    const metrics = currentWeek.map((d) => m("c1", d, 1000, 4))
    const r = buildReport(dealer, [campaign("c1", "Creta Search")], metrics, [], "week", NOW)
    expect(r.insight).toMatch(/better than the ₹400 we committed/)
  })

  it("owns an overrun rather than burying it", () => {
    const metrics = currentWeek.map((d) => m("c1", d, 1000, 1)) // CPL 1000
    const r = buildReport(dealer, [campaign("c1", "X")], metrics, [], "week", NOW)
    expect(r.insight).toMatch(/above the ₹400 we committed/)
    expect(r.insight).toMatch(/our priority/)
  })

  it("says something useful when nothing came through", () => {
    const metrics = currentWeek.map((d) => m("c1", d, 1000, 0))
    const r = buildReport(dealer, [campaign("c1", "X")], metrics, [], "week", NOW)
    expect(r.insight).toMatch(/No enquiries/)
    expect(r.insight).toMatch(/corrected/)
  })

  it("never emits undefined or NaN", () => {
    const r = buildReport(dealer, [], [], [], "week", NOW)
    expect(r.insight).not.toMatch(/undefined|NaN/)
  })
})

describe("top campaign", () => {
  it("is the cheapest per enquiry, not the one with the most leads", () => {
    const metrics = [
      ...currentWeek.map((d) => m("c1", d, 5000, 10)),  // 20 leads/day cost, CPL 500
      ...currentWeek.map((d) => m("c2", d, 1000, 5)),   // CPL 200, fewer leads
    ]
    const r = buildReport(
      dealer,
      [campaign("c1", "High volume"), campaign("c2", "Efficient")],
      metrics, [], "week", NOW,
    )
    expect(r.topCampaign?.name).toBe("Efficient")
  })
})

describe("activity log", () => {
  function opt(over: Partial<Optimization> = {}): Optimization {
    return {
      id: "o1", campaignId: "c1", dealerId: "d1", kind: "shift_budget",
      rationale: "Meta is delivering leads at ₹261 against ₹548 on Google over the last 7 days.",
      proposedChange: {}, priorState: null, requiresApproval: true,
      status: "applied", provenance: "simulated", decidedBy: "u_am1",
      createdAt: `${day(3)}T10:00:00.000Z`, decidedAt: `${day(3)}T10:00:00.000Z`,
      appliedAt: `${day(3)}T10:05:00.000Z`, ...over,
    }
  }

  it("includes changes that were actually applied", () => {
    const r = buildReport(dealer, [campaign("c1", "X")], [], [opt()], "week", NOW)
    expect(r.activity).toHaveLength(1)
    expect(r.activity[0].title).toMatch(/Rebalanced budget/)
  })

  it("excludes proposals that were never acted on", () => {
    const r = buildReport(
      dealer, [campaign("c1", "X")], [], [opt({ status: "proposed" })], "week", NOW,
    )
    expect(r.activity).toHaveLength(0)
  })

  it("strips the platform jargon out of the dealer-facing wording", () => {
    const r = buildReport(dealer, [campaign("c1", "X")], [], [opt()], "week", NOW)
    const text = `${r.activity[0].title} ${r.activity[0].why}`.toLowerCase()
    for (const word of ["meta", "google", "api", "ad set", "cpl", "₹"]) {
      expect(text).not.toContain(word)
    }
  })

  it("reads as the team's work, never as something automated", () => {
    const r = buildReport(dealer, [campaign("c1", "X")], [], [opt()], "week", NOW)
    const text = `${r.activity[0].title} ${r.activity[0].why}`.toLowerCase()
    for (const word of ["automat", "system", "algorithm", "ai ", "bot", "engine"]) {
      expect(text).not.toContain(word)
    }
  })

  it("leaves out changes from before the reporting period", () => {
    const old = opt({ appliedAt: `${day(40)}T10:00:00.000Z`, createdAt: `${day(40)}T10:00:00.000Z`, decidedAt: `${day(40)}T10:00:00.000Z` })
    const r = buildReport(dealer, [campaign("c1", "X")], [], [old], "week", NOW)
    expect(r.activity).toHaveLength(0)
  })
})
