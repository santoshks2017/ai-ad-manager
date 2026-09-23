import Link from "next/link"
import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { buildReport, type ReportPeriod } from "@/lib/reports"
import { inr, inrShort, num, pct } from "@/lib/format"

export const dynamic = "force-dynamic"

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
]

export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; dealer?: string }>
}) {
  const sp = await searchParams
  const period = PERIODS.find((p) => p.id === sp.period)?.id ?? "week"

  const store = await getStore()
  const [dealers, campaigns, metrics, optimizations] = await Promise.all([
    store.listDealers(),
    store.listCampaigns(),
    store.listMetrics(),
    store.listOptimizations(),
  ])

  const active = dealers.filter((d) => d.status === "active")
  const selected = sp.dealer ? active.filter((d) => d.id === sp.dealer) : active

  const reports = selected.map((d) =>
    buildReport(d, campaigns, metrics, optimizations, period),
  )

  return (
    <Shell
      title="Reports"
      subtitle="What each showroom gets to see"
      actions={
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`/reports?period=${p.id}${sp.dealer ? `&dealer=${sp.dealer}` : ""}`}
              aria-current={p.id === period ? "page" : undefined}
              className={`px-3 h-9 inline-flex items-center text-sm border transition-colors ${
                p.id === period
                  ? "border-ink bg-ink text-white font-medium"
                  : "border-rule bg-surface text-ink-soft hover:bg-ground"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      }
    >
      <div className="card p-4 mb-6 text-sm text-ink-soft max-w-3xl">
        <span className="font-medium text-ink">
          This is dealer-facing copy, so it is written for the dealer.
        </span>{" "}
        The activity log describes what the account team did and why, in plain language —
        no platform names, no jargon, and nothing that reads as automated. An account
        manager should read it before it goes out.
      </div>

      <div className="space-y-6">
        {reports.map((r) => {
          const dealer = dealers.find((d) => d.id === r.dealerId)!
          const beat = r.cplVsCommitted !== null && r.cplVsCommitted >= 0
          return (
            <article key={r.dealerId} className="card overflow-hidden">
              <header className="px-5 py-4 border-b border-rule bg-ground flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-display font-bold text-base">{dealer.name}</div>
                  <div className="text-2xs text-ink-faint mt-0.5 num">
                    {r.periodStart} to {r.periodEnd} · {dealer.city}
                  </div>
                </div>
                {r.cplVsCommitted !== null && (
                  <span
                    className={`px-2 py-0.5 text-2xs uppercase tracking-[0.1em] font-medium border ${
                      beat
                        ? "bg-signal-soft text-signal border-signal/20"
                        : "bg-alert-soft text-alert border-alert/25"
                    }`}
                  >
                    {beat ? "Within commitment" : "Above commitment"}
                  </span>
                )}
              </header>

              <div className="px-5 py-5 border-b border-rule">
                <p className="text-[15px] leading-relaxed">{r.insight}</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border-b border-rule">
                <Figure label="Spend" value={inrShort(r.spend)} />
                <Figure label="Enquiries" value={num(r.leads)} />
                <Figure
                  label="Cost per enquiry"
                  value={r.cpl ? inr(r.cpl) : "—"}
                  delta={r.cplChange}
                />
                <Figure
                  label="Committed"
                  value={r.committedCpl ? inr(r.committedCpl) : "Not set"}
                />
              </div>

              {r.platforms.length > 0 && (
                <div className="px-5 py-4 border-b border-rule">
                  <div className="eyebrow mb-2">Where the budget went</div>
                  <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm max-w-xl">
                    {r.platforms.map((p) => (
                      <div key={p.platform} className="flex justify-between gap-3">
                        <dt className="text-ink-soft capitalize">{p.platform}</dt>
                        <dd className="num">
                          {inrShort(p.spend)} · {num(p.leads)} enquiries
                          {p.cpl ? ` · ${inr(p.cpl)}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="px-5 py-4">
                <div className="eyebrow mb-3">What we did this {r.period}</div>
                {r.activity.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    No changes were made during this period.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {r.activity.map((a, i) => (
                      <li key={i} className="flex gap-3.5">
                        <span className="num text-2xs text-ink-faint shrink-0 pt-0.5 w-14">
                          {a.date.slice(5)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{a.title}</div>
                          <p className="text-sm text-ink-soft mt-0.5">{a.why}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <footer className="px-5 py-3 bg-ground border-t border-rule flex flex-wrap items-center justify-between gap-3">
                <span className="text-2xs text-ink-faint">
                  Draft — not yet sent to the showroom.
                </span>
                <button className="btn-quiet" disabled title="Delivery is not wired up yet">
                  Send to showroom
                </button>
              </footer>
            </article>
          )
        })}

        {reports.length === 0 && (
          <div className="sheet p-10 text-center">
            <div className="font-display font-bold text-lg">Nothing to report yet</div>
            <p className="text-sm text-ink-soft mt-2">
              Reports appear once a showroom has campaigns running.
            </p>
          </div>
        )}
      </div>
    </Shell>
  )
}

function Figure({
  label, value, delta,
}: {
  label: string
  value: string
  delta?: number | null
}) {
  // Falling cost per enquiry is an improvement, so the arrow reads that way.
  const good = delta === null || delta === undefined ? null : delta < 0
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className="num text-xl font-semibold mt-1">{value}</div>
      {delta !== null && delta !== undefined && Math.abs(delta) > 0.005 && (
        <div className={`num text-2xs mt-0.5 ${good ? "text-viz-good" : "text-viz-bad"}`}>
          {delta < 0 ? "▼" : "▲"} {pct(Math.abs(delta), 0)}
        </div>
      )}
    </div>
  )
}
