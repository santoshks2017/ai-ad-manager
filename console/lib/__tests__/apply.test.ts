import { describe, it, expect } from "vitest"
import { rateLimitCheck } from "../apply"
import type { Campaign, Optimization } from "../types"

const NOW = new Date("2026-09-23T12:00:00Z")
const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()

const campaign = {
  id: "c1", dealerId: "d1", platform: "meta", platformCampaignId: "p1",
  dailyBudget: 3000,
} as Campaign

function opt(over: Partial<Optimization> = {}): Optimization {
  return {
    id: "o", campaignId: "c1", dealerId: "d1", kind: "shift_budget",
    rationale: "", proposedChange: {}, priorState: null, requiresApproval: true,
    status: "approved", provenance: "simulated", decidedBy: null,
    createdAt: "", decidedAt: null, appliedAt: null, ...over,
  }
}

describe("Meta's four budget changes an hour", () => {
  it("allows a budget change when three have gone in the last hour", () => {
    const recent = [10, 20, 30].map((m) => opt({ appliedAt: minsAgo(m) }))
    const r = rateLimitCheck({
      optimization: opt(), campaign, recentlyApplied: recent, now: NOW,
    })
    expect(r.ok).toBe(true)
  })

  it("blocks the fifth", () => {
    const recent = [10, 20, 30, 40].map((m) => opt({ appliedAt: minsAgo(m) }))
    const r = rateLimitCheck({
      optimization: opt(), campaign, recentlyApplied: recent, now: NOW,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.retryAfterMinutes).toBeGreaterThan(0)
      expect(r.note).toMatch(/four budget changes an hour/i)
    }
  })

  it("counts only the last hour, not older changes", () => {
    const recent = [90, 120, 150, 180].map((m) => opt({ appliedAt: minsAgo(m) }))
    expect(
      rateLimitCheck({ optimization: opt(), campaign, recentlyApplied: recent, now: NOW }).ok,
    ).toBe(true)
  })

  it("does not count non-budget changes against the budget ceiling", () => {
    const recent = [10, 20, 30, 40].map((m) =>
      opt({ kind: "pause_underperformer", appliedAt: minsAgo(m) }),
    )
    expect(
      rateLimitCheck({ optimization: opt(), campaign, recentlyApplied: recent, now: NOW }).ok,
    ).toBe(true)
  })
})

describe("the daily ceiling", () => {
  it("blocks an eleventh change in 24 hours whatever its kind", () => {
    const recent = Array.from({ length: 10 }, (_, i) =>
      opt({ kind: "pause_underperformer", appliedAt: minsAgo(70 + i * 60) }),
    )
    const r = rateLimitCheck({
      optimization: opt({ kind: "pause_underperformer" }),
      campaign, recentlyApplied: recent, now: NOW,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.note).toMatch(/daily ceiling/i)
  })

  it("ignores proposals that were never applied", () => {
    const recent = Array.from({ length: 12 }, () => opt({ appliedAt: null }))
    expect(
      rateLimitCheck({ optimization: opt(), campaign, recentlyApplied: recent, now: NOW }).ok,
    ).toBe(true)
  })
})
