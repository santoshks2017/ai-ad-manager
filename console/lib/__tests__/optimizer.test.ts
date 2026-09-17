import { describe, it, expect } from "vitest"
import { detect } from "../optimizer"
import type { Campaign, Dealer, MetricsDaily } from "../types"

const NOW = new Date("2026-09-20T00:00:00Z")
const DAY = 86_400_000
const day = (ago: number) =>
  new Date(NOW.getTime() - ago * DAY).toISOString().slice(0, 10)

/** Default account config for fixtures: agency-owned, agency-billed. */
function acct() {
  return {
    ownership: "agency_owned" as const,
    billing: "agency_billed" as const,
    grant: "not_requested" as const,
    lastVerifiedAt: null,
  }
}

function dealer(over: Partial<Dealer> = {}): Dealer {
  return {
    id: "d1", code: "TEST", name: "Test Motors", city: "Lucknow",
    state: "UP", brands: ["Hyundai"], models: ["Creta"],
    monthlyBudget: 120_000, committedCpl: 400,
    virtualNumber: null, landingPageUrl: null, lmsAccountRef: null,
    status: "active", ownerId: "u1",
    platform: {
      google: acct(), meta: acct(),
      googleCustomerId: "g", googleState: "ready", googleVerified: true,
      metaBusinessId: "m", metaPageId: "p", metaAdAccountId: "a",
      metaState: "ready", metaVerified: true,
      servicesAgreementSigned: true, legalDocsCollected: true,
    },
    createdAt: "", updatedAt: "", ...over,
  }
}

function campaign(id: string, platform: "google" | "meta", dailyBudget = 2000): Campaign {
  return {
    id, dealerId: "d1", platform, platformCampaignId: `pc_${id}`,
    name: id, objective: "leads", dailyBudget, status: "active",
    provenance: "simulated", createdBy: "u1", createdAt: "",
  }
}

function metric(
  campaignId: string, platform: "google" | "meta", daysAgo: number,
  o: Partial<MetricsDaily> = {},
): MetricsDaily {
  return {
    id: `${campaignId}_${daysAgo}`, dealerId: "d1", campaignId, platform,
    date: day(daysAgo), spend: 1000, impressions: 20_000, clicks: 400,
    leads: 3, provenance: "simulated", ...o,
  }
}

describe("zero-conversion burn", () => {
  it("proposes a pause when spend is 3x target CPL with no leads", () => {
    const metrics = [0, 1, 2, 3, 4].map((d) =>
      metric("c1", "google", d, { spend: 500, leads: 0 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    const pause = out.find((p) => p.kind === "pause_underperformer")
    expect(pause).toBeDefined()
    expect(pause!.proposedChange).toEqual({ action: "pause" })
  })

  it("auto-applies, because pausing is reversible and unambiguous", () => {
    const metrics = [0, 1, 2, 3, 4].map((d) =>
      metric("c1", "google", d, { spend: 500, leads: 0 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "pause_underperformer")!.requiresApproval).toBe(false)
  })

  it("stores prior state so the pause can be undone", () => {
    const metrics = [0, 1, 2, 3, 4].map((d) =>
      metric("c1", "google", d, { spend: 500, leads: 0 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "pause_underperformer")!.priorState)
      .toMatchObject({ status: "active" })
  })

  it("stays quiet when leads are arriving", () => {
    const metrics = [0, 1, 2, 3, 4].map((d) =>
      metric("c1", "google", d, { spend: 500, leads: 2 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "pause_underperformer")).toBeUndefined()
  })

  it("waits for at least 3 days before calling it", () => {
    const metrics = [0, 1].map((d) => metric("c1", "google", d, { spend: 900, leads: 0 }))
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "pause_underperformer")).toBeUndefined()
  })
})

describe("CPL breach", () => {
  it("fires when blended CPL runs more than 15% over the commitment", () => {
    // 1000 spend / 2 leads = 500 CPL against a 400 commitment (+25%)
    const metrics = [0, 1, 2, 3].map((d) =>
      metric("c1", "google", d, { spend: 1000, leads: 2 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "adjust_bid")).toBeDefined()
  })

  it("quotes both the observed and the committed CPL in the rationale", () => {
    const metrics = [0, 1, 2, 3].map((d) =>
      metric("c1", "google", d, { spend: 1000, leads: 2 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    const r = out.find((p) => p.kind === "adjust_bid")!.rationale
    expect(r).toMatch(/₹500/)
    expect(r).toMatch(/₹400/)
  })

  it("tolerates being just inside the 15% band", () => {
    // 1000 / 2.3 ≈ 435 CPL — over target but within tolerance
    const metrics = [0, 1, 2, 3].map((d) =>
      metric("c1", "google", d, { spend: 1000, leads: 2.3 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "adjust_bid")).toBeUndefined()
  })

  it("stays silent when no CPL was ever committed", () => {
    const metrics = [0, 1, 2, 3].map((d) =>
      metric("c1", "google", d, { spend: 1000, leads: 1 }),
    )
    const out = detect({
      dealer: dealer({ committedCpl: null }),
      campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "adjust_bid")).toBeUndefined()
  })
})

describe("platform imbalance", () => {
  it("proposes shifting budget when one platform is 40%+ cheaper", () => {
    const metrics = [
      ...[0, 1, 2].map((d) => metric("c1", "google", d, { spend: 1000, leads: 1 })),
      ...[0, 1, 2].map((d) => metric("c2", "meta", d, { spend: 1000, leads: 4 })),
    ]
    const out = detect({
      dealer: dealer(),
      campaigns: [campaign("c1", "google"), campaign("c2", "meta")],
      metrics, now: NOW,
    })
    const shift = out.find((p) => p.kind === "shift_budget")
    expect(shift).toBeDefined()
    expect(shift!.proposedChange).toMatchObject({ from: "google", to: "meta" })
  })

  it("always asks a human before moving budget", () => {
    const metrics = [
      ...[0, 1, 2].map((d) => metric("c1", "google", d, { spend: 1000, leads: 1 })),
      ...[0, 1, 2].map((d) => metric("c2", "meta", d, { spend: 1000, leads: 4 })),
    ]
    const out = detect({
      dealer: dealer(),
      campaigns: [campaign("c1", "google"), campaign("c2", "meta")],
      metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "shift_budget")!.requiresApproval).toBe(true)
  })

  it("ignores a gap too small to be worth the disruption", () => {
    const metrics = [
      ...[0, 1, 2].map((d) => metric("c1", "google", d, { spend: 1000, leads: 3 })),
      ...[0, 1, 2].map((d) => metric("c2", "meta", d, { spend: 1000, leads: 3.5 })),
    ]
    const out = detect({
      dealer: dealer(),
      campaigns: [campaign("c1", "google"), campaign("c2", "meta")],
      metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "shift_budget")).toBeUndefined()
  })

  it("needs both platforms running to compare them", () => {
    const metrics = [0, 1, 2].map((d) => metric("c2", "meta", d, { spend: 1000, leads: 4 }))
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c2", "meta")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "shift_budget")).toBeUndefined()
  })
})

describe("budget pacing", () => {
  it("flags a month projecting past the cap", () => {
    // 20 days at 8000/day on a 120k cap projects to ~240k
    const metrics = Array.from({ length: 20 }, (_, i) =>
      metric("c1", "google", i, { spend: 8000, leads: 20 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    const pacing = out.find((p) => p.kind === "pacing_correction")
    expect(pacing).toBeDefined()
    expect(pacing!.proposedChange).toHaveProperty("dailyBudgetTo")
  })

  it("trims rather than pausing, so delivery continues", () => {
    const metrics = Array.from({ length: 20 }, (_, i) =>
      metric("c1", "google", i, { spend: 8000, leads: 20 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    const change = out.find((p) => p.kind === "pacing_correction")!.proposedChange as any
    expect(change.dailyBudgetTo).toBeLessThan(change.dailyBudgetFrom)
    expect(change.dailyBudgetTo).toBeGreaterThanOrEqual(0)
  })

  it("stays quiet when pacing is on track", () => {
    const metrics = Array.from({ length: 20 }, (_, i) =>
      metric("c1", "google", i, { spend: 3800, leads: 10 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "pacing_correction")).toBeUndefined()
  })

  it("will not read a run rate from the first few days of a month", () => {
    const early = new Date("2026-09-03T00:00:00Z")
    const metrics = [0, 1].map((d) =>
      ({ ...metric("c1", "google", d, { spend: 50_000, leads: 1 }),
         date: new Date(early.getTime() - d * DAY).toISOString().slice(0, 10) }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: early,
    })
    expect(out.find((p) => p.kind === "pacing_correction")).toBeUndefined()
  })
})

describe("creative fatigue", () => {
  it("fires on a sharp CTR drop with real volume behind it", () => {
    const metrics = [
      ...[0, 1, 2, 3].map((d) =>
        metric("c1", "meta", d, { impressions: 50_000, clicks: 250 }),
      ),
      ...[8, 9, 10, 11].map((d) =>
        metric("c1", "meta", d, { impressions: 50_000, clicks: 600 }),
      ),
    ]
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "meta")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "refresh_creative")).toBeDefined()
  })

  it("ignores a drop on volume too thin to be meaningful", () => {
    const metrics = [
      ...[0, 1].map((d) => metric("c1", "meta", d, { impressions: 400, clicks: 2 })),
      ...[8, 9].map((d) => metric("c1", "meta", d, { impressions: 400, clicks: 20 })),
    ]
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "meta")], metrics, now: NOW,
    })
    expect(out.find((p) => p.kind === "refresh_creative")).toBeUndefined()
  })
})

describe("queue behaviour", () => {
  it("sorts the most severe proposal to the top", () => {
    const metrics = [
      ...[0, 1, 2, 3, 4].map((d) => metric("c1", "google", d, { spend: 500, leads: 0 })),
      ...[0, 1, 2, 3, 4].map((d) =>
        metric("c2", "meta", d, { impressions: 50_000, clicks: 250 }),
      ),
      ...[8, 9, 10].map((d) =>
        metric("c2", "meta", d, { impressions: 50_000, clicks: 600 }),
      ),
    ]
    const out = detect({
      dealer: dealer(),
      campaigns: [campaign("c1", "google"), campaign("c2", "meta")],
      metrics, now: NOW,
    })
    expect(out.length).toBeGreaterThan(1)
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].severity).toBeGreaterThanOrEqual(out[i].severity)
    }
  })

  it("gives every proposal a rationale a dealer could read", () => {
    const metrics = [0, 1, 2, 3, 4].map((d) =>
      metric("c1", "google", d, { spend: 500, leads: 0 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    for (const p of out) {
      expect(p.rationale.length).toBeGreaterThan(40)
      expect(p.rationale).not.toMatch(/undefined|NaN|\[object/)
    }
  })

  it("proposes nothing when there is nothing wrong", () => {
    const metrics = [0, 1, 2, 3].map((d) =>
      metric("c1", "google", d, { spend: 1000, leads: 3 }),
    )
    const out = detect({
      dealer: dealer(), campaigns: [campaign("c1", "google")], metrics, now: NOW,
    })
    expect(out).toHaveLength(0)
  })
})
