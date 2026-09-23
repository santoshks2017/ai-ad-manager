import Link from "next/link"
import { Shell } from "@/components/Shell"
import { CplBar } from "@/components/CplBar"
import { getStore } from "@/lib/store"
import { inr, inrShort, num } from "@/lib/format"
import { SHOWROOM_STATUS_LABEL } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function DealerBook() {
  const store = await getStore()
  const [dealers, metrics] = await Promise.all([
    store.listDealers(),
    store.listMetrics(),
  ])

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const recent = metrics.filter((m) => m.date >= since)

  const byDealer = new Map<string, { spend: number; leads: number }>()
  for (const m of recent) {
    const acc = byDealer.get(m.dealerId) ?? { spend: 0, leads: 0 }
    acc.spend += m.spend
    acc.leads += m.leads
    byDealer.set(m.dealerId, acc)
  }

  const totalSpend = recent.reduce((s, m) => s + m.spend, 0)
  const totalLeads = recent.reduce((s, m) => s + m.leads, 0)
  const blendedCpl = totalLeads > 0 ? totalSpend / totalLeads : 0

  const overTarget = dealers.filter((d) => {
    const agg = byDealer.get(d.id)
    if (!agg || !d.committedCpl || agg.leads === 0) return false
    return agg.spend / agg.leads > d.committedCpl
  })

  return (
    <Shell
      title="Showroom book"
      subtitle="Last 30 days across every showroom we run"
      actions={
        <div className="flex gap-2">
          <Link href="/showrooms/new" className="btn-quiet">
            Add showroom
          </Link>
          <Link href="/quote" className="btn-primary">
            New quote
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule mb-8">
        <Stat label="Spend" value={inrShort(totalSpend)} />
        <Stat label="Leads" value={num(totalLeads)} />
        <Stat label="Blended CPL" value={inr(blendedCpl)} />
        <Stat
          label="Over committed CPL"
          value={`${overTarget.length} of ${dealers.filter((d) => d.status === "active").length}`}
          tone={overTarget.length > 0 ? "alert" : "signal"}
        />
      </div>

      {overTarget.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-alert-soft border border-alert/25 text-sm">
          <span className="font-medium text-alert">
            {overTarget.length} dealer{overTarget.length > 1 ? "s are" : " is"} running
            above committed CPL.
          </span>{" "}
          <span className="text-ink-soft">
            {overTarget.map((d) => d.name).join(", ")}. Review before the month closes —
            an unexplained overrun at invoice time is how disputes start.
          </span>
        </div>
      )}

      <div className="sheet overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left">
              <Th>Showroom</Th>
              <Th>City</Th>
              <Th align="right">Budget/mo</Th>
              <Th align="right">Spend 30d</Th>
              <Th align="right">Leads</Th>
              <Th align="right">CPL</Th>
              <Th>Against committed</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => {
              const agg = byDealer.get(d.id)
              const cpl = agg && agg.leads > 0 ? agg.spend / agg.leads : null
              return (
                <tr key={d.id} className="sheet-row hover:bg-ground">
                  <td className="px-3 py-2.5">
                    <Link href={`/dealers/${d.id}`} className="hover:underline">
                      <span className="num text-2xs text-ink-faint mr-2">{d.code}</span>
                      <span className="font-medium">{d.name}</span>
                    </Link>
                    <div className="text-2xs text-ink-faint mt-0.5">
                      {d.brands.join(", ")} · {d.models.slice(0, 3).join(", ")}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">{d.city}</td>
                  <td className="px-3 py-2.5 text-right num">{inrShort(d.monthlyBudget)}</td>
                  <td className="px-3 py-2.5 text-right num">
                    {agg ? inrShort(agg.spend) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right num">
                    {agg ? num(agg.leads) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right num font-medium">
                    {cpl ? inr(cpl) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {cpl !== null ? (
                      <CplBar actual={cpl} committed={d.committedCpl} />
                    ) : (
                      <span className="text-2xs text-ink-faint">Not running</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={d.status} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-2xs text-ink-faint">
        The vertical tick on each bar is the committed CPL. Green is under, amber is
        within 10%, oxide is over.
      </p>
    </Shell>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "alert" | "signal"
}) {
  const color =
    tone === "alert" ? "text-alert" : tone === "signal" ? "text-signal" : "text-ink"
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={`num text-2xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  )
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th
      className={`px-3 py-2 eyebrow font-medium bg-ground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-signal-soft text-signal border-signal/20",
    pending_connection: "bg-ground text-ink-soft border-rule",
    pending_audit: "bg-accent-soft text-accent border-accent/20",
    audit_ready: "bg-ember-soft text-ember-dark border-ember/30",
    audit_shared: "bg-ember-soft text-ember-dark border-ember/30",
    paused: "bg-amber-soft text-amber border-amber/25",
    churned: "bg-ground text-ink-faint border-rule",
  }
  const label =
    (SHOWROOM_STATUS_LABEL as Record<string, string>)[status] ?? status
  return (
    <span
      className={`inline-block px-2 py-0.5 text-2xs uppercase tracking-[0.1em]
                  font-medium border whitespace-nowrap ${map[status] ?? map.churned}`}
    >
      {label}
    </span>
  )
}
