import { Shell } from "@/components/Shell"
import { PacingBar } from "@/components/charts"
import { getStore } from "@/lib/store"
import { budgetStatus, dueAlerts, type BudgetSetting } from "@/lib/budget"
import { inr, inrShort, num } from "@/lib/format"
import type { Dealer, Platform } from "@/lib/types"
import { PauseAll } from "./PauseAll"

export const dynamic = "force-dynamic"

/**
 * Per-platform caps, derived from the showroom's contracted monthly budget
 * using the same split the quote engine recommends.
 *
 * These are derived rather than stored because nothing sends alerts yet — the
 * alert timestamps that stop a threshold re-firing belong with the sender, and
 * inventing a settings collection before then would just be state nobody
 * writes to.
 */
function settingsFor(dealers: Dealer[]): BudgetSetting[] {
  const out: BudgetSetting[] = []
  for (const d of dealers) {
    if (d.status !== "active") continue
    for (const [platform, share] of [["meta", 0.65], ["google", 0.35]] as [Platform, number][]) {
      out.push({
        dealerId: d.id,
        platform,
        monthlyCap: Math.round(d.monthlyBudget * share),
        alertAt75: true,
        alertAt95: true,
        autoPauseAtCap: false,
        alert75SentAt: null,
        alert95SentAt: null,
      })
    }
  }
  return out
}

export default async function Budget() {
  const store = await getStore()
  const [dealers, metrics, campaigns] = await Promise.all([
    store.listDealers(),
    store.listMetrics(),
    store.listCampaigns(),
  ])

  const settings = settingsFor(dealers)
  const statuses = budgetStatus(dealers, settings, metrics)
  const alerts = dueAlerts(statuses, settings)

  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "—"
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length

  const totalCap = statuses.reduce((s, x) => s + x.monthlyCap, 0)
  const totalSpent = statuses.reduce((s, x) => s + x.spent, 0)
  const totalProjected = statuses.reduce((s, x) => s + x.projected, 0)
  const atRisk = statuses.filter((s) => s.state === "at_risk" || s.state === "over")

  return (
    <Shell
      title="Budget"
      subtitle="Month to date against contracted budget, per platform"
      actions={<PauseAll activeCount={activeCampaigns} />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule mb-6">
        <Stat label="Contracted" value={inrShort(totalCap)} />
        <Stat label="Spent" value={inrShort(totalSpent)} />
        <Stat label="Projected" value={inrShort(totalProjected)}
              tone={totalProjected > totalCap ? "alert" : undefined} />
        <Stat label="Over budget" value={`${atRisk.length} of ${statuses.length}`}
              tone={atRisk.length > 0 ? "alert" : "signal"} />
      </div>

      {alerts.length > 0 && (
        <section className="mb-6">
          <div className="eyebrow mb-2">Alerts due</div>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`px-4 py-3 border text-sm ${
                  a.threshold === 95
                    ? "bg-alert-soft border-alert/25"
                    : "bg-amber-soft border-amber/25"
                }`}
              >
                <span className="font-medium">
                  {dealerName(a.dealerId)} · {a.platform}
                </span>{" "}
                <span className="text-ink-soft">{a.message}</span>
              </div>
            ))}
          </div>
          <p className="text-2xs text-ink-faint mt-2">
            These are the alerts that would send right now. Nothing dispatches them yet —
            each fires once per threshold per month once the sender is wired up.
          </p>
        </section>
      )}

      <div className="sheet">
        {statuses.map((s) => (
          <div key={`${s.dealerId}-${s.platform}`} className="sheet-row first:border-t-0 px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
              <div>
                <span className="text-sm font-medium">{dealerName(s.dealerId)}</span>
                <span className="text-2xs text-ink-faint ml-2 capitalize">{s.platform}</span>
              </div>
              <div className="num text-sm">
                {inrShort(s.spent)} of {inrShort(s.monthlyCap)}
                <span
                  className={`ml-3 font-medium ${
                    s.state === "over" || s.state === "at_risk"
                      ? "text-viz-bad"
                      : s.state === "watch"
                        ? "text-viz-warn"
                        : "text-viz-good"
                  }`}
                >
                  {Math.round(s.utilisation * 100)}%
                </span>
              </div>
            </div>
            <PacingBar
              spent={s.spent}
              budget={s.monthlyCap}
              projected={s.projected}
              elapsedFraction={s.daysElapsed / s.daysInMonth}
            />
            <p className="text-2xs text-ink-soft mt-1.5">{s.message}</p>
          </div>
        ))}
        {statuses.length === 0 && (
          <div className="p-8 text-center text-sm text-ink-soft">
            No active showrooms with a contracted budget.
          </div>
        )}
      </div>

      <p className="text-2xs text-ink-faint mt-3">
        The tick marks where spend should be today; the dashed line is where the current
        run rate lands by month end. Caps split 65/35 Meta/Google, matching the quote
        engine&rsquo;s recommendation.
      </p>
    </Shell>
  )
}

function Stat({
  label, value, tone,
}: {
  label: string
  value: string
  tone?: "alert" | "signal"
}) {
  const color = tone === "alert" ? "text-alert" : tone === "signal" ? "text-signal" : ""
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={`num text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  )
}
