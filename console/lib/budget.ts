/**
 * Budget control.
 *
 * The analytics pacing report answers "is this showroom going to overspend?".
 * This answers "what do we do about it?" — caps, alert thresholds, and the
 * stop button.
 *
 * Alerts fire once per threshold per month. A budget alert that re-sends every
 * fifteen minutes gets muted by the account manager within a day, which is
 * worse than not alerting at all.
 */

import type { Dealer, MetricsDaily, Platform } from "./types"

export interface BudgetSetting {
  dealerId: string
  platform: Platform
  monthlyCap: number
  alertAt75: boolean
  alertAt95: boolean
  /** Stop spending automatically at 100% rather than only warning. */
  autoPauseAtCap: boolean
  alert75SentAt: string | null
  alert95SentAt: string | null
}

export type BudgetState = "healthy" | "watch" | "at_risk" | "over"

export interface BudgetStatus {
  dealerId: string
  platform: Platform
  monthlyCap: number
  spent: number
  remaining: number
  utilisation: number
  /** Where spend lands at month end on the current run rate. */
  projected: number
  projectedUtilisation: number
  state: BudgetState
  daysElapsed: number
  daysInMonth: number
  /** Daily spend that would land exactly on the cap. */
  safeDailySpend: number
  message: string
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`

export function budgetStatus(
  dealers: Dealer[],
  settings: BudgetSetting[],
  metrics: MetricsDaily[],
  now = new Date(),
): BudgetStatus[] {
  const monthPrefix = now.toISOString().slice(0, 7)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const daysLeft = Math.max(0, daysInMonth - daysElapsed)

  return settings
    .map((setting) => {
      const dealer = dealers.find((d) => d.id === setting.dealerId)
      const spent = metrics
        .filter(
          (m) =>
            m.dealerId === setting.dealerId &&
            m.platform === setting.platform &&
            m.date.startsWith(monthPrefix),
        )
        .reduce((s, m) => s + m.spend, 0)

      const remaining = Math.max(0, setting.monthlyCap - spent)
      const utilisation = setting.monthlyCap > 0 ? spent / setting.monthlyCap : 0
      const projected = daysElapsed > 0 ? (spent / daysElapsed) * daysInMonth : 0
      const projectedUtilisation =
        setting.monthlyCap > 0 ? projected / setting.monthlyCap : 0

      const state: BudgetState =
        utilisation >= 1
          ? "over"
          : projectedUtilisation > 1.05
            ? "at_risk"
            : projectedUtilisation > 0.95
              ? "watch"
              : "healthy"

      const safeDailySpend = daysLeft > 0 ? remaining / daysLeft : 0

      const message =
        state === "over"
          ? `Cap reached. ${inr(spent)} spent against a ${inr(setting.monthlyCap)} cap.`
          : state === "at_risk"
            ? `Tracking to ${inr(projected)} against a ${inr(setting.monthlyCap)} cap. Hold daily spend to ${inr(safeDailySpend)} for the remaining ${daysLeft} days to stay inside it.`
            : state === "watch"
              ? `Close to the cap — projecting ${inr(projected)}. Worth watching.`
              : `On track. ${inr(spent)} of ${inr(setting.monthlyCap)} used with ${daysLeft} days left.`

      return {
        dealerId: setting.dealerId,
        platform: setting.platform,
        monthlyCap: setting.monthlyCap,
        spent, remaining, utilisation, projected, projectedUtilisation, state,
        daysElapsed, daysInMonth, safeDailySpend,
        message: dealer ? message : message,
      }
    })
    .sort((a, b) => b.projectedUtilisation - a.projectedUtilisation)
}

export interface BudgetAlert {
  dealerId: string
  platform: Platform
  threshold: 75 | 95
  message: string
}

/**
 * Which alerts are due right now.
 *
 * Returns only thresholds crossed AND not already sent this month, so a caller
 * that runs every fifteen minutes does not re-notify on every pass.
 */
export function dueAlerts(
  statuses: BudgetStatus[],
  settings: BudgetSetting[],
  now = new Date(),
): BudgetAlert[] {
  const monthPrefix = now.toISOString().slice(0, 7)
  const sentThisMonth = (at: string | null) => Boolean(at && at.startsWith(monthPrefix))

  const alerts: BudgetAlert[] = []

  for (const status of statuses) {
    const setting = settings.find(
      (s) => s.dealerId === status.dealerId && s.platform === status.platform,
    )
    if (!setting) continue

    if (
      setting.alertAt95 &&
      status.utilisation >= 0.95 &&
      !sentThisMonth(setting.alert95SentAt)
    ) {
      alerts.push({
        dealerId: status.dealerId,
        platform: status.platform,
        threshold: 95,
        message: `${inr(status.spent)} of the ${inr(status.monthlyCap)} monthly cap is spent — 95% reached.`,
      })
      continue // 95 supersedes 75; do not send both in one pass.
    }

    if (
      setting.alertAt75 &&
      status.utilisation >= 0.75 &&
      !sentThisMonth(setting.alert75SentAt)
    ) {
      alerts.push({
        dealerId: status.dealerId,
        platform: status.platform,
        threshold: 75,
        message: `${inr(status.spent)} of the ${inr(status.monthlyCap)} monthly cap is spent — 75% reached.`,
      })
    }
  }
  return alerts
}
