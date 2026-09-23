import Link from "next/link"
import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { reconcile, reconciliationSummary } from "@/lib/reconciliation"
import { inr, num, pct } from "@/lib/format"
import { LEAD_STATUSES } from "@/lib/types"
import type { LeadStatus } from "@/lib/types"
import { LeadRow } from "./LeadRow"

export const dynamic = "force-dynamic"

const VIEWS = [
  { id: "inbox", label: "Inbox" },
  { id: "reconciliation", label: "Reconciliation" },
] as const

export default async function Leads({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string; dealer?: string; platform?: string; status?: string; q?: string
  }>
}) {
  const sp = await searchParams
  const view = VIEWS.find((v) => v.id === sp.view)?.id ?? "inbox"

  const store = await getStore()
  const [dealers, campaigns] = await Promise.all([
    store.listDealers(),
    store.listCampaigns(),
  ])

  const leads = await store.listLeads({
    dealerId: sp.dealer || undefined,
    platform: sp.platform || undefined,
    status: (sp.status as LeadStatus) || undefined,
  })

  const q = (sp.q ?? "").trim().toLowerCase()
  const filtered = q
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
      )
    : leads

  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "—"
  const campaignName = (id: string | null) =>
    id ? (campaigns.find((c) => c.id === id)?.name ?? null) : null

  const newCount = leads.filter((l) => l.status === "new").length
  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({
      view, dealer: sp.dealer ?? "", platform: sp.platform ?? "",
      status: sp.status ?? "", q: sp.q ?? "", ...over,
    })) {
      if (v) p.set(k, v)
    }
    return `/leads?${p.toString()}`
  }

  return (
    <Shell
      title="Leads"
      subtitle={
        view === "inbox"
          ? `${num(filtered.length)} lead${filtered.length === 1 ? "" : "s"}, ${num(newCount)} not yet worked`
          : "What we hold against what the platforms counted"
      }
    >
      <nav className="flex gap-1 mb-6" aria-label="View">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={qs({ view: v.id })}
            aria-current={v.id === view ? "page" : undefined}
            className={`px-3 h-8 inline-flex items-center text-sm border transition-colors ${
              v.id === view
                ? "border-accent bg-accent-soft text-accent font-medium"
                : "border-rule bg-surface text-ink-soft hover:bg-ground"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "inbox" ? (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3 mb-5">
            <input type="hidden" name="view" value="inbox" />
            <div>
              <label className="label" htmlFor="q">Search</label>
              <input
                id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Name or phone"
                className="field w-48"
              />
            </div>
            <div>
              <label className="label" htmlFor="dealer">Showroom</label>
              <select id="dealer" name="dealer" defaultValue={sp.dealer ?? ""} className="field w-44">
                <option value="">All showrooms</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="platform">Platform</label>
              <select id="platform" name="platform" defaultValue={sp.platform ?? ""} className="field w-32">
                <option value="">All</option>
                <option value="google">Google</option>
                <option value="meta">Meta</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={sp.status ?? ""} className="field w-36">
                <option value="">All statuses</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">Apply</button>
            <a
              href={`/api/leads/export?${new URLSearchParams({
                dealer: sp.dealer ?? "", platform: sp.platform ?? "",
                status: sp.status ?? "", q: sp.q ?? "",
              }).toString()}`}
              className="btn-quiet"
            >
              Export CSV
            </a>
          </form>

          <div className="sheet overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="text-left">
                  {["Name", "Phone", "Model", "Platform", "Came in via", "Received", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2 eyebrow font-medium bg-ground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    dealerName={dealerName(lead.dealerId)}
                    campaignName={campaignName(lead.campaignId)}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr className="sheet-row">
                    <td colSpan={7} className="px-3 py-10 text-center text-ink-soft">
                      No leads match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 200 && (
            <p className="text-2xs text-ink-faint mt-2">
              Showing the 200 most recent of {num(filtered.length)}. Narrow the filters or
              export to see the rest.
            </p>
          )}
          <p className="text-2xs text-ink-faint mt-3">
            Phone numbers are hidden until clicked. Leads will sync from the LMS once that
            integration lands — until then these records live here.
          </p>
        </>
      ) : (
        <Reconciliation
          leads={await store.listLeads({})}
          metrics={await store.listMetrics()}
          dealers={dealers}
        />
      )}
    </Shell>
  )
}

function Reconciliation({
  leads, metrics, dealers,
}: {
  leads: Awaited<ReturnType<Awaited<ReturnType<typeof getStore>>["listLeads"]>>
  metrics: Awaited<ReturnType<Awaited<ReturnType<typeof getStore>>["listMetrics"]>>
  dealers: Awaited<ReturnType<Awaited<ReturnType<typeof getStore>>["listDealers"]>>
}) {
  const rows = reconcile(leads, metrics)
  const s = reconciliationSummary(rows)
  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "—"

  const verdictTone: Record<string, string> = {
    aligned: "bg-signal-soft text-signal border-signal/20",
    calls_uncounted: "bg-accent-soft text-accent border-accent/25",
    tracking_gap: "bg-alert-soft text-alert border-alert/25",
    no_platform_data: "bg-amber-soft text-amber border-amber/25",
    no_leads: "bg-ground text-ink-faint border-rule",
  }
  const verdictLabel: Record<string, string> = {
    aligned: "Aligned",
    calls_uncounted: "Calls uncounted",
    tracking_gap: "Tracking gap",
    no_platform_data: "No platform data",
    no_leads: "No activity",
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 text-sm text-ink-soft max-w-3xl">
        <span className="font-medium text-ink">
          CPL depends on which lead count you use, and the two never match exactly.
        </span>{" "}
        Pixels miss form fills, and calls to the tracking number are invisible to Google
        and Meta entirely. A small gap is normal. A large one, or one in the wrong
        direction, needs fixing before that CPL goes in front of a dealer.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border border-rule">
        <Stat label="Platforms counted" value={num(s.platformLeads)} />
        <Stat label="We hold" value={num(s.capturedLeads)} />
        <Stat label="Arrived by phone" value={num(s.callLeads)} />
        <Stat
          label="Rows needing attention"
          value={num(s.needsAttention)}
          tone={s.needsAttention > 0 ? "alert" : "signal"}
        />
      </div>

      <div className="sheet overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-left">
              {["Showroom", "Platform", "Platform said", "We hold", "Of which calls", "Gap", "Their CPL", "Evidenced CPL", "Verdict"].map((h, i) => (
                <th key={h} className={`px-3 py-2 eyebrow font-medium bg-ground ${i >= 2 && i <= 7 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.dealerId}-${r.platform}`} className="sheet-row hover:bg-ground">
                <td className="px-3 py-2.5">{dealerName(r.dealerId)}</td>
                <td className="px-3 py-2.5 capitalize">{r.platform}</td>
                <td className="px-3 py-2.5 text-right num">{num(r.platformLeads)}</td>
                <td className="px-3 py-2.5 text-right num">{num(r.capturedLeads)}</td>
                <td className="px-3 py-2.5 text-right num text-ink-soft">{num(r.callLeads)}</td>
                <td className={`px-3 py-2.5 text-right num font-medium ${r.gap < 0 ? "text-alert" : ""}`}>
                  {r.gap > 0 ? "+" : ""}{num(r.gap)}
                  {r.platformLeads > 0 && (
                    <span className="text-2xs text-ink-faint ml-1.5">
                      ({r.gapPercent > 0 ? "+" : ""}{pct(r.gapPercent, 0)})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right num text-ink-soft">
                  {r.platformCpl ? inr(r.platformCpl) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right num font-medium">
                  {r.capturedCpl ? inr(r.capturedCpl) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block px-2 py-0.5 text-2xs uppercase tracking-[0.08em] font-medium border whitespace-nowrap ${verdictTone[r.verdict]}`}>
                    {verdictLabel[r.verdict]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        {rows
          .filter((r) => r.verdict === "tracking_gap" || r.verdict === "no_platform_data")
          .map((r) => (
            <div
              key={`${r.dealerId}-${r.platform}-note`}
              className="px-4 py-3 bg-alert-soft border border-alert/25 text-sm"
            >
              <span className="font-medium text-alert">
                {dealerName(r.dealerId)} · {r.platform}.
              </span>{" "}
              <span className="text-ink-soft">{r.explanation}</span>
            </div>
          ))}
      </div>

      <p className="text-2xs text-ink-faint">
        &ldquo;Evidenced CPL&rdquo; divides spend by leads we can actually produce a record
        for. It is the more conservative number and the one to quote.
      </p>
    </div>
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
