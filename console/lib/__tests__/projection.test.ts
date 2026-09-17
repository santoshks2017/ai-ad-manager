import { describe, it, expect } from "vitest"
import { project } from "../projection"
import type { ProjectionInput } from "../types"

/** Neutral month (April, seasonality 0.98) so tests don't drift by season. */
const NOW = new Date("2026-04-15T00:00:00Z")

const base: ProjectionInput = {
  budget: 100_000,
  city: "Lucknow",
  brand: "Hyundai",
  model: "Creta",
  objective: "leads",
  durationDays: 30,
}

describe("projection: range inversion", () => {
  it("gives MORE leads at the low CPL and FEWER at the high CPL", () => {
    const out = project(base, { now: NOW })
    // The single most dangerous bug in this engine: if these invert, every
    // forecast silently inflates.
    expect(out.leadsHigh).toBeGreaterThan(out.leadsLow)
    expect(out.cplHigh).toBeGreaterThan(out.cplLow)
  })

  it("keeps blended CPL consistent with budget and lead counts", () => {
    const out = project(base, { now: NOW })
    // cplLow pairs with leadsHigh, and cplHigh with leadsLow.
    expect(out.cplLow).toBeCloseTo(Math.round(base.budget / out.leadsHigh), -1)
    expect(out.cplHigh).toBeCloseTo(Math.round(base.budget / out.leadsLow), -1)
  })

  it("holds the inversion per platform too", () => {
    const out = project(base, { now: NOW })
    for (const p of out.platforms) {
      expect(p.cplHigh).toBeGreaterThan(p.cplLow)
      expect(p.leadsHigh).toBeGreaterThanOrEqual(p.leadsLow)
    }
  })
})

describe("projection: budget scaling", () => {
  it("scales leads roughly linearly with budget", () => {
    const small = project({ ...base, budget: 50_000 }, { now: NOW })
    const large = project({ ...base, budget: 200_000 }, { now: NOW })
    expect(large.leadsHigh).toBeGreaterThan(small.leadsHigh * 3)
  })

  it("leaves blended CPL roughly unchanged when only budget changes", () => {
    const a = project({ ...base, budget: 60_000 }, { now: NOW })
    const b = project({ ...base, budget: 300_000 }, { now: NOW })
    // Same split and same segment, so CPL should be stable within rounding.
    expect(Math.abs(a.cplLow - b.cplLow)).toBeLessThan(a.cplLow * 0.1)
  })
})

describe("projection: small-budget concentration", () => {
  it("runs a sub-30k budget on a single platform", () => {
    const out = project({ ...base, budget: 20_000 }, { now: NOW })
    expect(out.platforms).toHaveLength(1)
  })

  it("explains why it concentrated", () => {
    const out = project({ ...base, budget: 20_000 }, { now: NOW })
    expect(out.notes.join(" ")).toMatch(/below ₹30,000/i)
  })

  it("splits across both platforms above the threshold", () => {
    const out = project({ ...base, budget: 100_000 }, { now: NOW })
    expect(out.platforms).toHaveLength(2)
    const total = out.platforms.reduce((s, p) => s + p.spendShare, 0)
    expect(total).toBeCloseTo(1, 5)
  })

  it("sends a small test-drive budget to Google, not Meta", () => {
    const out = project(
      { ...base, budget: 20_000, objective: "test_drive" },
      { now: NOW },
    )
    expect(out.platforms[0].platform).toBe("google")
  })
})

describe("projection: city tiers", () => {
  it("prices a metro above a tier-2 city", () => {
    const metro = project({ ...base, city: "Mumbai" }, { now: NOW })
    const tier2 = project({ ...base, city: "Kanpur" }, { now: NOW })
    expect(metro.cplLow).toBeGreaterThan(tier2.cplLow)
  })

  it("falls back to tier2 for an unknown city rather than throwing", () => {
    const out = project({ ...base, city: "Nowhere-ville" }, { now: NOW })
    expect(out.leadsHigh).toBeGreaterThan(0)
  })
})

describe("projection: segments", () => {
  it("prices luxury well above entry hatch", () => {
    const luxury = project({ ...base, brand: "BMW", model: "X3" }, { now: NOW })
    const entry = project({ ...base, brand: "Maruti", model: "Alto" }, { now: NOW })
    expect(luxury.cplLow).toBeGreaterThan(entry.cplLow * 2)
  })

  it("matches a model name with extra words", () => {
    const a = project({ ...base, model: "Creta" }, { now: NOW })
    const b = project({ ...base, model: "New Creta Facelift" }, { now: NOW })
    expect(b.cplLow).toBe(a.cplLow)
  })
})

describe("projection: objectives", () => {
  it("prices a test drive above a general enquiry", () => {
    const td = project({ ...base, objective: "test_drive" }, { now: NOW })
    const leads = project({ ...base, objective: "leads" }, { now: NOW })
    expect(td.cplLow).toBeGreaterThan(leads.cplLow)
  })
})

describe("projection: honesty guarantees", () => {
  it("reports benchmark basis and low confidence with no history", () => {
    const out = project(base, { now: NOW })
    expect(out.basis).toBe("benchmark")
    expect(out.confidence).toBe("low")
    expect(out.sampleSize).toBe(0)
  })

  it("warns that a benchmark projection is not our own data", () => {
    const out = project(base, { now: NOW })
    expect(out.notes.join(" ")).toMatch(/not our own campaign history/i)
  })

  it("tells the AM to quote the upper end when confidence is low", () => {
    const out = project(base, { now: NOW })
    expect(out.notes.join(" ")).toMatch(/upper end/i)
  })

  it("upgrades to historical basis and high confidence with enough samples", () => {
    const historical = Array.from({ length: 25 }, () => ({
      platform: "meta" as const, cpl: 150, leads: 40,
    }))
    const out = project(base, { now: NOW, historical })
    expect(out.basis).toBe("historical")
    expect(out.confidence).toBe("high")
    expect(out.sampleSize).toBe(25)
  })

  it("narrows the range as confidence rises", () => {
    const wide = project(base, { now: NOW })
    const historical = Array.from({ length: 25 }, () => ({
      platform: "meta" as const, cpl: 150, leads: 40,
    }))
    const tight = project(base, { now: NOW, historical })
    const wideSpread = (wide.cplHigh - wide.cplLow) / wide.cplLow
    const tightSpread = (tight.cplHigh - tight.cplLow) / tight.cplLow
    expect(tightSpread).toBeLessThan(wideSpread)
  })

  it("always sets an expiry so a stale quote can't become a commitment", () => {
    const out = project(base, { now: NOW })
    const expiry = new Date(out.expiresAt).getTime()
    expect(expiry).toBeGreaterThan(NOW.getTime())
    const days = (expiry - NOW.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBeCloseTo(14, 0)
  })

  it("never returns a single point estimate", () => {
    const out = project(base, { now: NOW })
    expect(out.cplHigh).not.toBe(out.cplLow)
    expect(out.leadsHigh).not.toBe(out.leadsLow)
  })
})

describe("projection: seasonality", () => {
  it("prices the Diwali peak above the monsoon trough", () => {
    const oct = project(base, { now: new Date("2026-10-15T00:00:00Z") })
    const jul = project(base, { now: new Date("2026-07-15T00:00:00Z") })
    expect(oct.cplLow).toBeGreaterThan(jul.cplLow)
  })

  it("flags the festive competition risk in its notes", () => {
    const oct = project(base, { now: new Date("2026-10-15T00:00:00Z") })
    expect(oct.notes.join(" ")).toMatch(/festive/i)
  })
})
