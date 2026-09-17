import Link from "next/link"
import { Shell } from "@/components/Shell"
import { LineChart, PacingBar, RankedBars } from "@/components/charts"
import { getStore } from "@/lib/store"
import { inr, inrShort, num, pct } from "@/lib/format"
import {
  byDealer, byPlatform, bySegment, daily, delta, pacing, periods, totals,
} from "@/lib/analytics"

export const dynamic = "force-dynamic"

const REPORTS = [
  { id: "overview", label: "Overview" },
  { id: "dealers", label: "Dealer performance" },
  { id: "platforms", label: "Platform efficiency" },
  { id: "segments", label: "City & model" },
  { id: "pacing", label: "Budget pacing" },
] as const

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
]

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; days?: string }>
}) {
  const sp = await searchParams
  const report = REPORTS.find((r) => r.id === sp.report)?.id ?? "overview"
  const days = RANGES.find((r) => String(r.days) === sp.days)?.days ?? 30

  const store = await getStore()
  const [dealers, campaigns, allMetrics] = await Promise.all([
    store.listDealers(),
    store.listCampaigns(),
    store.listMetrics(),
  ])

  const { current, previous } = periods(allMetrics, days)

  return (
    <Shell title="Analytics" subtitle={`Across all dealers, last ${days} days`}>
      {/* Filters sit in one row above the charts. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
        <nav className="flex flex-wrap gap-1" aria-label="Report">
          {REPORTS.map((r) => (
            <Link
              key={r.id}
              href={`/analytics?report=${r.id}&days=${days}`}
              aria-current={r.id === report ? "page" : undefined}
              className={`px-3 h-8 inline-flex items-center text-sm border transition-colors ${
                r.id === report
                  ? "border-accent bg-accent-soft text-accent font-medium"
                  : "border-rule bg-surface text-ink-soft hover:bg-ground"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-1" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/analytics?report=${report}&days=${r.days}`}
              aria-current={r.days === days ? "true" : undefined}
              className={`px-3 h-8 inline-flex items-center text-sm border num transition-colors ${
                r.days === days
                  ? "border-ink bg-ink text-white font-medium"
                  : "border-rule bg-surface text-ink-soft hover:bg-ground"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {report === "overview" && <Overview current={current} previous={previous} days={days} />}
      {report === "dealers" && <Dealers dealers={dealers} rows={current} />}
      {report === "platforms" && <Platforms rows={current} />}
      {report === "segments" && (
        <Segments dealers={dealers} campaigns={campaigns} rows={current} />
      )}
      {report === "pacing" && <Pacing dealers={dealers} rows={allMetrics} />}
    </Shell>
  )
}

/* ---------------------------------------------------------------- Overview */

function Overview({
  current, previous, days,
}: {
  current: Awaited<ReturnType<typeof getStore>> extends never ? never : any[]
  previous: any[]
  days: number
}) {
  const t = totals(current)
  const p = totals(previous)

  // Spend, leads and CPL have different scales, so they get their own charts
  // rather than sharing one with a second y-axis.
  const points = daily(current)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
        <Tile label="Spend" value={inrShort(t.spend)} change={delta(t.spend, p.spend)} invert />
        <Tile label="Leads" value={num(t.leads)} change={delta(t.leads, p.leads)} />
        <Tile
          label="Blended CPL"
          value={t.cpl ? inr(t.cpl) : "—"}
          change={t.cpl && p.cpl ? delta(t.cpl, p.cpl) : null}
          invert
        />
        <Tile
          label="Conversion rate"
          value={t.convRate ? pct(t.convRate, 2) : "—"}
          change={t.convRate && p.convRate ? delta(t.convRate, p.convRate) : null}
        />
      </div>

      <LineChart
        points={points.map((d) => ({ date: d.date, value: d.cpl }))}
        label="Cost per lead"
        format="inr"
      />

      <div className="grid md:grid-cols-2 gap-6">
        <LineChart
          points={points.map((d) => ({ date: d.date, value: d.spend }))}
          label="Daily spend"
          format="inrShort"
          height={150}
        />
        <LineChart
          points={points.map((d) => ({ date: d.date, value: d.leads }))}
          label="Daily leads"
          format="count"
          height={150}
        />
      </div>

      <p className="text-2xs text-ink-faint">
        Change is against the {days} days immediately before this period. For spend and
        CPL a fall is an improvement, so the arrows are read accordingly.
      </p>
    </div>
  )
}

function Tile({
  label, value, change, invert = false,
}: {
  label: string
  value: string
  change: number | null
  /** True when down is good — spend and CPL. */
  invert?: boolean
}) {
  const good = change === null ? null : invert ? change < 0 : change > 0
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className="num text-2xl font-semibold mt-1">{value}</div>
      {change !== null && (
        <div
          className={`num text-2xs mt-1 ${
            good === null ? "text-ink-faint" : good ? "text-viz-good" : "text-viz-bad"
          }`}
        >
          {change > 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- Dealers */

function Dealers({ dealers, rows }: { dealers: any[]; rows: any[] }) {
  const ranked = byDealer(dealers, rows).filter((d) => d.totals.spend > 0)

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft max-w-2xl">
        Delivered CPL against what we committed, worst first. This is the queue to work
        down — an overrun found at invoice time is a dispute; found now it is an
        adjustment.
      </p>
      <RankedBars
        rows={ranked.map((d) => ({
          label: d.dealer.name,
          sublabel: `${d.dealer.city} · ${d.dealer.code}`,
          value: d.cplRatio ?? 0,
          display: d.totals.cpl ? inr(d.totals.cpl) : "—",
          tone: d.status === "over" ? "bad" : d.status === "near" ? "warn"
            : d.status === "under" ? "good" : "neutral",
          note:
            d.cplRatio === null
              ? "No committed CPL recorded"
              : `${Math.round(Math.abs(d.cplRatio - 1) * 100)}% ${
                  d.cplRatio > 1 ? "above" : "below"
                } the ₹${d.dealer.committedCpl} committed · ${num(d.totals.leads)} leads on ${inrShort(d.totals.spend)}`,
        }))}
      />
    </div>
  )
}

/* --------------------------------------------------------------- Platforms */

function Platforms({ rows }: { rows: any[] }) {
  const split = byPlatform(rows)
  const colors: Record<string, string> = { google: "bg-viz-google", meta: "bg-viz-meta" }

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft max-w-2xl">
        Where the money goes against where the leads come from. A platform taking more
        spend share than lead share is the one to trim.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {split.map((p) => (
          <div key={p.platform} className="sheet p-4">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 ${colors[p.platform]}`} />
              <span className="font-medium capitalize">{p.platform}</span>
            </div>
            <div className="num text-3xl font-semibold mt-3">
              {p.totals.cpl ? inr(p.totals.cpl) : "—"}
            </div>
            <div className="eyebrow mt-0.5">cost per lead</div>

            <dl className="mt-4 space-y-2 text-sm">
              <Split label="Spend share" value={p.spendShare} tone={colors[p.platform]} />
              <Split label="Lead share" value={p.leadShare} tone={colors[p.platform]} />
            </dl>

            <dl className="mt-4 pt-3 border-t border-rule space-y-1.5 text-sm">
              <Row label="Spend" value={inrShort(p.totals.spend)} />
              <Row label="Leads" value={num(p.totals.leads)} />
              <Row label="CTR" value={p.totals.ctr ? pct(p.totals.ctr, 2) : "—"} />
              <Row label="Cost per click" value={p.totals.cpc ? inr(p.totals.cpc) : "—"} />
              <Row
                label="Click to lead"
                value={p.totals.convRate ? pct(p.totals.convRate, 1) : "—"}
              />
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}

function Split({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex justify-between text-2xs mb-1">
        <dt className="text-ink-soft">{label}</dt>
        <dd className="num">{pct(value, 0)}</dd>
      </div>
      <div className="h-1.5 bg-ground border border-rule">
        <div className={`h-full ${tone}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  )
}

/* ---------------------------------------------------------------- Segments */

function Segments({
  dealers, campaigns, rows,
}: {
  dealers: any[]
  campaigns: any[]
  rows: any[]
}) {
  const segments = bySegment(dealers, campaigns, rows)

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft max-w-2xl">
        What actually works, by city, model and platform. This is the report that
        compounds — it is the same data the quote tool reads as its historical basis, so
        every month of delivery makes the next quote tighter.
      </p>

      <div className="sheet overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left">
              {["City", "Model", "Platform", "Dealers", "Spend", "Leads", "CPL"].map((h, i) => (
                <th
                  key={h}
                  className={`px-3 py-2 eyebrow font-medium bg-ground ${i >= 3 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.key} className="sheet-row hover:bg-ground">
                <td className="px-3 py-2.5">{s.city}</td>
                <td className="px-3 py-2.5">{s.model}</td>
                <td className="px-3 py-2.5 capitalize">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 ${
                        s.platform === "google" ? "bg-viz-google" : "bg-viz-meta"
                      }`}
                    />
                    {s.platform}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right num">{s.dealerCount}</td>
                <td className="px-3 py-2.5 text-right num">{inrShort(s.totals.spend)}</td>
                <td className="px-3 py-2.5 text-right num">{num(s.totals.leads)}</td>
                <td className="px-3 py-2.5 text-right num font-medium">
                  {s.totals.cpl ? inr(s.totals.cpl) : "—"}
                </td>
              </tr>
            ))}
            {segments.length === 0 && (
              <tr className="sheet-row">
                <td colSpan={7} className="px-3 py-8 text-center text-ink-soft">
                  No delivery in this period yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-2xs text-ink-faint">
        A segment backed by one dealer is one dealer's experience, not a benchmark. The
        dealer count is there so a thin sample is visible rather than implied.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ Pacing */

function Pacing({ dealers, rows }: { dealers: any[]; rows: any[] }) {
  const paced = pacing(dealers, rows)

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft max-w-2xl">
        Month-to-date spend against contracted budget. The tick marks where spend should
        be today; the dashed line is where this run rate lands by month end.
        Under-delivery matters as much as overspend — unspent budget is a renewal
        conversation nobody wants to have.
      </p>

      <div className="sheet">
        {paced.map((p) => (
          <div key={p.dealer.id} className="sheet-row first:border-t-0 px-4 py-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2">
              <div>
                <span className="text-sm font-medium">{p.dealer.name}</span>
                <span className="text-2xs text-ink-faint ml-2">{p.dealer.city}</span>
              </div>
              <div className="num text-sm">
                {inrShort(p.monthSpend)} of {inrShort(p.monthlyBudget)}
                <span
                  className={`ml-3 font-medium ${
                    p.status === "over"
                      ? "text-viz-bad"
                      : p.status === "under"
                        ? "text-viz-warn"
                        : "text-viz-good"
                  }`}
                >
                  {p.status === "over"
                    ? `tracking ${inrShort(p.projected)}`
                    : p.status === "under"
                      ? `will underspend by ${inrShort(p.monthlyBudget - p.projected)}`
                      : "on track"}
                </span>
              </div>
            </div>
            <PacingBar
              spent={p.monthSpend}
              budget={p.monthlyBudget}
              projected={p.projected}
              elapsedFraction={p.daysElapsed / p.daysInMonth}
            />
          </div>
        ))}
        {paced.length === 0 && (
          <div className="p-8 text-center text-sm text-ink-soft">No active dealers.</div>
        )}
      </div>
    </div>
  )
}
