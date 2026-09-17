import Link from "next/link"
import { notFound } from "next/navigation"
import { Shell } from "@/components/Shell"
import { CplBar } from "@/components/CplBar"
import { getStore } from "@/lib/store"
import { inr, inrShort, num, relativeDate } from "@/lib/format"
import type { ProvisionState } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function DealerDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const store = await getStore()
  const dealer = await store.getDealer(id)
  if (!dealer) notFound()

  const [campaigns, metrics, optimizations] = await Promise.all([
    store.listCampaigns(id),
    store.listMetrics(id),
    store.listOptimizations(),
  ])

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const recent = metrics.filter((m) => m.date >= since)
  const spend = recent.reduce((s, m) => s + m.spend, 0)
  const leads = recent.reduce((s, m) => s + m.leads, 0)
  const cpl = leads > 0 ? spend / leads : null

  const theirs = optimizations.filter((o) => o.dealerId === id)

  return (
    <Shell
      title={dealer.name}
      subtitle={`${dealer.code} · ${dealer.city}, ${dealer.state} · ${dealer.brands.join(", ")}`}
      actions={
        <Link href="/" className="btn-quiet">
          Back to book
        </Link>
      }
    >
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule border border-rule">
            <Stat label="Spend 30d" value={inrShort(spend)} />
            <Stat label="Leads" value={num(leads)} />
            <Stat label="CPL" value={cpl ? inr(cpl) : "—"} />
            <Stat
              label="Committed"
              value={dealer.committedCpl ? inr(dealer.committedCpl) : "Not set"}
            />
          </div>

          {cpl !== null && (
            <div className="card p-5">
              <div className="eyebrow mb-3">Against commitment</div>
              <CplBar actual={cpl} committed={dealer.committedCpl} width={280} />
              <p className="text-sm text-ink-soft mt-3">
                {dealer.committedCpl === null
                  ? "No CPL was committed for this dealer, so there is nothing to reconcile against."
                  : cpl > dealer.committedCpl
                    ? `Running ${Math.round(((cpl - dealer.committedCpl) / dealer.committedCpl) * 100)}% above the committed CPL. Worth correcting before the month closes.`
                    : `Running ${Math.round(((dealer.committedCpl - cpl) / dealer.committedCpl) * 100)}% below the committed CPL.`}
              </p>
            </div>
          )}

          <div>
            <div className="eyebrow mb-2">Campaigns</div>
            <div className="sheet overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left">
                    {["Campaign", "Platform", "Daily budget", "Status"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 eyebrow font-medium bg-ground ${i === 2 ? "text-right" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="sheet-row">
                      <td className="px-3 py-2.5 num text-2xs">{c.name}</td>
                      <td className="px-3 py-2.5 capitalize">{c.platform}</td>
                      <td className="px-3 py-2.5 text-right num">{inr(c.dailyBudget)}</td>
                      <td className="px-3 py-2.5">{c.status}</td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr className="sheet-row">
                      <td colSpan={4} className="px-3 py-6 text-center text-ink-soft">
                        Nothing running yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="eyebrow mb-2">What we have changed</div>
            <div className="card divide-y divide-rule">
              {theirs.length === 0 && (
                <div className="p-6 text-center text-sm text-ink-soft">
                  No changes made yet.
                </div>
              )}
              {theirs.map((o) => (
                <div key={o.id} className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm capitalize">
                      {o.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-2xs text-ink-faint num">
                      {relativeDate(o.createdAt)}
                    </span>
                    <span className="text-2xs px-1.5 py-0.5 border border-rule text-ink-faint">
                      {o.status}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft mt-1.5">{o.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6 min-w-0">
          <div className="card p-5">
            <div className="eyebrow mb-3">Platform accounts</div>
            <p className="text-2xs text-ink-faint mb-3">
              Both platforms require one ad account per advertiser, so each dealer gets
              its own. We create and run all of it — the dealer never signs in.
            </p>
            <dl className="space-y-2.5 text-sm">
              <Provision label="Google Ads account" state={dealer.platform.googleState} />
              <Provision label="Google verification" state={dealer.platform.googleVerified ? "ready" : "not_started"} />
              <Provision label="Meta Page + ad account" state={dealer.platform.metaState} />
              <Provision label="Meta verification" state={dealer.platform.metaVerified ? "ready" : "not_started"} />
              <Provision label="Services agreement" state={dealer.platform.servicesAgreementSigned ? "ready" : "blocked"} />
              <Provision label="Legal documents" state={dealer.platform.legalDocsCollected ? "ready" : "not_started"} />
            </dl>
            {!dealer.platform.servicesAgreementSigned && (
              <p className="text-2xs text-alert mt-3">
                The signed agreement is what authorises us to advertise as this dealer's
                representative. Both platforms expect it. Campaigns should not go live
                without it.
              </p>
            )}
          </div>

          <div className="card p-5">
            <div className="eyebrow mb-3">Delivery setup</div>
            <dl className="space-y-2.5 text-sm">
              <Row label="Monthly budget" value={inr(dealer.monthlyBudget)} />
              <Row label="Virtual number" value={dealer.virtualNumber ?? "Not assigned"} />
              <Row
                label="Landing page"
                value={dealer.landingPageUrl ? "Configured" : "Not set up"}
              />
              <Row label="LMS account" value={dealer.lmsAccountRef ?? "Not provisioned"} />
            </dl>
            <p className="text-2xs text-ink-faint mt-3">
              Landing page, number and LMS are provisioned outside this console. Leads
              flow from the page and the number straight into the dealer's LMS.
            </p>
          </div>
        </aside>
      </div>
    </Shell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className="num text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="num text-right">{value}</dd>
    </div>
  )
}

function Provision({ label, state }: { label: string; state: ProvisionState }) {
  const map: Record<ProvisionState, { text: string; cls: string }> = {
    ready: { text: "Ready", cls: "text-signal" },
    in_progress: { text: "In progress", cls: "text-amber" },
    not_started: { text: "Not started", cls: "text-ink-faint" },
    blocked: { text: "Blocked", cls: "text-alert" },
  }
  const s = map[state]
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`text-right font-medium ${s.cls}`}>{s.text}</dd>
    </div>
  )
}
