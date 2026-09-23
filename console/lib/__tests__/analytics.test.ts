import { describe, it, expect } from "vitest"
import {
  byDealer, byPlatform, bySegment, daily, delta, pacing, periods, totals,
} from "../analytics"
import type { Campaign, Dealer, MetricsDaily } from "../types"

const NOW = new Date("2026-09-20T00:00:00Z")
const day = (ago: number) =>
  new Date(NOW.getTime() - ago * 86_400_000).toISOString().slice(0, 10)

/** Default account config for fixtures: agency-owned, agency-billed. */
function acct() {
  return {
    ownership: "agency_owned" as const,
    billing: "agency_billed" as const,
    grant: "not_requested" as const,
    lastVerifiedAt: null,
  }
}

function dealer(id: string, over: Partial<Dealer> = {}): Dealer {
  return {
    id, code: id.toUpperCase(), name: `${id} Motors`, city: "Lucknow",
    state: "UP", brands: ["Hyundai"], models: ["Creta"],
    monthlyBudget: 120_000, committedCpl: 400, virtualNumber: null,
    landingPageUrl: null, lmsAccountRef: null, status: "active", ownerId: null,
    platform: {
      google: acct(), meta: acct(),
      googleCustomerId: null, googleState: "ready", googleVerified: true,
      metaBusinessId: null, metaPageId: null, metaAdAccountId: null,
      metaState: "ready", metaVerified: true,
      googleBusinessProfileLinked: true,
      googleBusinessAccountEmail: null,
      servicesAgreementSigned: true, legalDocsCollected: true,
    },
    createdAt: "", updatedAt: "", ...over,
  }
}

function m(
  dealerId: string, platform: "google" | "meta", daysAgo: number,
  o: Partial<MetricsDaily> = {},
): MetricsDaily {
  return {
    id: `${dealerId}_${platform}_${daysAgo}`, dealerId, campaignId: null, platform,
    date: day(daysAgo), spend: 1000, impressions: 20_000, clicks: 400, leads: 4,
    provenance: "simulated", ...o,
  }
}

describe("totals", () => {
  it("derives CPL from summed spend and leads, not averaged daily CPLs", () => {
    // Day one: 500 spend / 1 lead = 500 CPL. Day two: 10,000 / 100 = 100 CPL.
    // Averaging the two rates gives 300. The true blended CPL is 10,500/101 ≈ 104.
    const rows = [
      m("d1", "google", 0, { spend: 500, leads: 1 }),
      m("d1", "google", 1, { spend: 10_000, leads: 100 }),
    ]
    const t = totals(rows)
    expect(t.cpl).toBeCloseTo(10_500 / 101, 2)
    expect(t.cpl).toBeLessThan(150)
  })

  it("returns null CPL rather than dividing by zero", () => {
    expect(totals([m("d1", "google", 0, { leads: 0 })]).cpl).toBeNull()
  })

  it("returns zeroed totals for no rows", () => {
    const t = totals([])
    expect(t.spend).toBe(0)
    expect(t.cpl).toBeNull()
  })

  it("computes CTR and conversion rate from summed counts", () => {
    const t = totals([m("d1", "google", 0, { impressions: 1000, clicks: 50, leads: 5 })])
    expect(t.ctr).toBeCloseTo(0.05, 5)
    expect(t.convRate).toBeCloseTo(0.1, 5)
  })
})

describe("daily", () => {
  it("collapses platforms into one point per day, oldest first", () => {
    const rows = [
      m("d1", "google", 1, { spend: 100, leads: 1 }),
      m("d1", "meta", 1, { spend: 200, leads: 3 }),
      m("d1", "google", 0, { spend: 150, leads: 2 }),
    ]
    const points = daily(rows)
    expect(points).toHaveLength(2)
    expect(points[0].date < points[1].date).toBe(true)
    expect(points[0].spend).toBe(300)
    expect(points[0].leads).toBe(4)
  })
})

describe("byPlatform", () => {
  it("reports shares of spend and of leads separately", () => {
    const rows = [
      m("d1", "google", 0, { spend: 600, leads: 2 }),
      m("d1", "meta", 0, { spend: 400, leads: 8 }),
    ]
    const split = byPlatform(rows)
    const google = split.find((p) => p.platform === "google")!
    const meta = split.find((p) => p.platform === "meta")!
    // Google takes more budget but produces fewer leads — the gap is the point.
    expect(google.spendShare).toBeCloseTo(0.6, 5)
    expect(google.leadShare).toBeCloseTo(0.2, 5)
    expect(meta.leadShare).toBeCloseTo(0.8, 5)
  })

  it("omits platforms with no spend", () => {
    expect(byPlatform([m("d1", "meta", 0)])).toHaveLength(1)
  })
})

describe("byDealer", () => {
  it("puts the worst CPL offender first", () => {
    const dealers = [dealer("d1"), dealer("d2")]
    const rows = [
      m("d1", "google", 0, { spend: 1000, leads: 5 }),  // 200 CPL, under 400
      m("d2", "google", 0, { spend: 1000, leads: 1 }),  // 1000 CPL, well over
    ]
    const ranked = byDealer(dealers, rows)
    expect(ranked[0].dealer.id).toBe("d2")
    expect(ranked[0].status).toBe("over")
    expect(ranked[1].status).toBe("under")
  })

  it("flags near-target separately from over-target", () => {
    const rows = [m("d1", "google", 0, { spend: 1000, leads: 2.6 })] // ~385 vs 400
    expect(byDealer([dealer("d1")], rows)[0].status).toBe("near")
  })

  it("reports unknown when no CPL was committed", () => {
    const rows = [m("d1", "google", 0, { spend: 1000, leads: 2 })]
    const ranked = byDealer([dealer("d1", { committedCpl: null })], rows)
    expect(ranked[0].status).toBe("unknown")
    expect(ranked[0].cplRatio).toBeNull()
  })
})

describe("bySegment", () => {
  it("groups by city, model and platform", () => {
    const dealers = [dealer("d1"), dealer("d2", { city: "Jaipur" })]
    const campaigns: Campaign[] = [
      {
        id: "c1", dealerId: "d1", platform: "google", platformCampaignId: "p1",
        name: "D1__Hyundai__Creta__leads__202609", objective: "leads",
        dailyBudget: 1000, status: "active", provenance: "simulated",
        createdBy: "u", createdAt: "",
      },
    ]
    const rows = [
      { ...m("d1", "google", 0), campaignId: "c1" },
      m("d2", "google", 0),
    ]
    const segs = bySegment(dealers, campaigns, rows)
    expect(segs.some((s) => s.city === "Lucknow" && s.model === "Creta")).toBe(true)
    expect(segs.some((s) => s.city === "Jaipur")).toBe(true)
  })

  it("counts distinct dealers behind a segment, so thin samples are visible", () => {
    const dealers = [dealer("d1"), dealer("d2")]
    const rows = [m("d1", "google", 0), m("d2", "google", 0)]
    const segs = bySegment(dealers, [], rows)
    expect(segs[0].dealerCount).toBe(2)
  })

  it("sorts by spend so the biggest segments lead", () => {
    const dealers = [dealer("d1"), dealer("d2", { city: "Jaipur" })]
    const rows = [
      m("d1", "google", 0, { spend: 100 }),
      m("d2", "google", 0, { spend: 5000 }),
    ]
    const segs = bySegment(dealers, [], rows)
    expect(segs[0].city).toBe("Jaipur")
  })
})

describe("pacing", () => {
  it("projects month-end spend from the run rate", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      m("d1", "google", i, { spend: 5000, date: `2026-09-${String(i + 1).padStart(2, "0")}` }),
    )
    const p = pacing([dealer("d1")], rows, NOW)[0]
    // 20 days at 5000/day, read on the 20th of a 30-day month -> ~150,000
    expect(p.projected).toBeGreaterThan(140_000)
    expect(p.status).toBe("over")
  })

  it("flags under-delivery, which is its own problem", () => {
    const rows = [m("d1", "google", 0, { spend: 100, date: "2026-09-01" })]
    expect(pacing([dealer("d1")], rows, NOW)[0].status).toBe("under")
  })

  it("ignores dealers who are not active", () => {
    expect(pacing([dealer("d1", { status: "pending_connection" })], [], NOW)).toHaveLength(0)
  })
})

describe("delta and periods", () => {
  it("returns null rather than dividing by a zero baseline", () => {
    expect(delta(100, 0)).toBeNull()
  })

  it("computes a signed percentage change", () => {
    expect(delta(120, 100)).toBeCloseTo(0.2, 5)
    expect(delta(80, 100)).toBeCloseTo(-0.2, 5)
  })

  it("splits into two non-overlapping windows", () => {
    const rows = Array.from({ length: 14 }, (_, i) => m("d1", "google", i))
    const { current, previous } = periods(rows, 7, NOW)
    expect(current.length).toBe(7)
    expect(previous.length).toBeGreaterThan(0)
    const currentDates = new Set(current.map((r) => r.date))
    expect(previous.every((r) => !currentDates.has(r.date))).toBe(true)
  })
})
