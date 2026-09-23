import { describe, it, expect } from "vitest"
import { budgetStatus, dueAlerts, type BudgetSetting } from "../budget"
import type { Dealer, MetricsDaily } from "../types"

// 20th of a 30-day month.
const NOW = new Date("2026-09-20T00:00:00Z")

const dealer = { id: "d1", name: "Test Motors" } as Dealer

function setting(over: Partial<BudgetSetting> = {}): BudgetSetting {
  return {
    dealerId: "d1", platform: "google", monthlyCap: 100_000,
    alertAt75: true, alertAt95: true, autoPauseAtCap: false,
    alert75SentAt: null, alert95SentAt: null, ...over,
  }
}

function spendOf(total: number, days = 20): MetricsDaily[] {
  return Array.from({ length: days }, (_, i) => ({
    id: `m${i}`, dealerId: "d1", campaignId: null, platform: "google" as const,
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    spend: total / days, impressions: 0, clicks: 0, leads: 0,
    provenance: "simulated" as const,
  }))
}

describe("state", () => {
  it("is healthy when pacing to land inside the cap", () => {
    const s = budgetStatus([dealer], [setting()], spendOf(60_000), NOW)[0]
    expect(s.state).toBe("healthy")
  })

  it("is at risk when projecting past the cap", () => {
    const s = budgetStatus([dealer], [setting()], spendOf(90_000), NOW)[0]
    expect(s.state).toBe("at_risk")
    expect(s.projected).toBeGreaterThan(100_000)
  })

  it("is over once the cap is actually reached", () => {
    const s = budgetStatus([dealer], [setting()], spendOf(100_000), NOW)[0]
    expect(s.state).toBe("over")
  })

  it("never reports negative remaining budget", () => {
    const s = budgetStatus([dealer], [setting()], spendOf(140_000), NOW)[0]
    expect(s.remaining).toBe(0)
  })
})

describe("the daily number an account manager can act on", () => {
  it("says what daily spend lands exactly on the cap", () => {
    const s = budgetStatus([dealer], [setting()], spendOf(90_000), NOW)[0]
    // 10,000 left over 10 remaining days.
    expect(Math.round(s.safeDailySpend)).toBe(1000)
  })

  it("puts that figure in the message when spend is at risk", () => {
    const s = budgetStatus([dealer], [setting()], spendOf(90_000), NOW)[0]
    expect(s.message).toMatch(/Hold daily spend to ₹1,000/)
  })
})

describe("alerts", () => {
  it("fires at 75%", () => {
    const st = budgetStatus([dealer], [setting()], spendOf(78_000), NOW)
    expect(dueAlerts(st, [setting()], NOW)[0].threshold).toBe(75)
  })

  it("sends 95 instead of 75, not both, in one pass", () => {
    const st = budgetStatus([dealer], [setting()], spendOf(96_000), NOW)
    const alerts = dueAlerts(st, [setting()], NOW)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].threshold).toBe(95)
  })

  it("does not re-send a threshold already sent this month", () => {
    const s = setting({ alert75SentAt: "2026-09-14T10:00:00.000Z" })
    const st = budgetStatus([dealer], [s], spendOf(78_000), NOW)
    expect(dueAlerts(st, [s], NOW)).toHaveLength(0)
  })

  it("does send again when the last send was a previous month", () => {
    const s = setting({ alert75SentAt: "2026-08-14T10:00:00.000Z" })
    const st = budgetStatus([dealer], [s], spendOf(78_000), NOW)
    expect(dueAlerts(st, [s], NOW)).toHaveLength(1)
  })

  it("respects an alert that has been switched off", () => {
    const s = setting({ alertAt75: false, alertAt95: false })
    const st = budgetStatus([dealer], [s], spendOf(97_000), NOW)
    expect(dueAlerts(st, [s], NOW)).toHaveLength(0)
  })
})
