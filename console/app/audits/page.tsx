import Link from "next/link"
import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { auditHeadline } from "@/lib/audit"
import { inr, inrShort, num, relativeDate } from "@/lib/format"
import { SHOWROOM_STATUS_LABEL } from "@/lib/types"
import type { AuditFinding } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function Audits() {
  const store = await getStore()
  const [audits, dealers] = await Promise.all([store.listAudits(), store.listDealers()])
  const dealerFor = (id: string) => dealers.find((d) => d.id === id)

  const awaiting = dealers.filter(
    (d) => d.status === "pending_connection" || d.status === "pending_audit",
  )

  return (
    <Shell
      title="Audits"
      subtitle="What a showroom is wasting today — the case for switching to us"
    >
      <div className="card p-4 mb-6 text-sm text-ink-soft max-w-3xl">
        <span className="font-medium text-ink">
          Ask for read-only access first, not campaign management.
        </span>{" "}
        It is a far smaller thing to agree to, it lets us show a dealer what their
        current spend is actually doing before they commit to anything, and the
        historical data it exposes is what replaces category benchmarks in the quote
        tool with this showroom&rsquo;s own numbers.
      </div>

      {awaiting.length > 0 && (
        <section className="mb-8">
          <div className="eyebrow mb-3">Waiting on account access</div>
          <div className="sheet">
            {awaiting.map((d) => (
              <div
                key={d.id}
                className="sheet-row first:border-t-0 px-4 py-3 flex flex-wrap
                           items-baseline justify-between gap-3"
              >
                <div>
                  <Link href={`/dealers/${d.id}`} className="font-medium text-sm hover:underline">
                    {d.name}
                  </Link>
                  <span className="text-2xs text-ink-faint ml-2">{d.city}</span>
                </div>
                <span className="text-sm text-ink-soft">
                  {SHOWROOM_STATUS_LABEL[d.status]}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {audits.length === 0 ? (
        <div className="sheet p-10 text-center">
          <div className="font-display font-bold text-lg">No audits yet</div>
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
            Once a showroom grants read-only access to their Google Ads account, the
            audit runs here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {audits.map((audit) => {
            const dealer = dealerFor(audit.dealerId)
            return (
              <article key={audit.id} className="card overflow-hidden">
                <header className="px-5 py-4 border-b border-rule bg-ground">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-display font-bold text-base">
                        {dealer?.name ?? "Unknown showroom"}
                      </div>
                      <div className="text-2xs text-ink-faint mt-0.5 num">
                        Google Ads {audit.googleCustomerId ?? "—"} · last{" "}
                        {audit.periodDays} days · {relativeDate(audit.createdAt)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-2xs uppercase tracking-[0.1em] font-medium border ${
                        audit.status === "shared"
                          ? "bg-signal-soft text-signal border-signal/20"
                          : "bg-ember-soft text-ember-dark border-ember/30"
                      }`}
                    >
                      {audit.status === "shared" ? "Shared" : "Ready to share"}
                    </span>
                  </div>
                </header>

                <div className="px-5 py-5 border-b border-rule">
                  <p className="text-[15px] leading-relaxed">{auditHeadline(audit)}</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-rule border-b border-rule">
                  <Figure label="Their spend" value={inrShort(audit.observedSpend)} />
                  <Figure label="Their leads" value={num(audit.observedLeads)} />
                  <Figure
                    label="Their CPL"
                    value={audit.observedCpl ? inr(audit.observedCpl) : "—"}
                  />
                  <Figure
                    label="Recoverable / month"
                    value={inr(audit.totalEstimatedWaste)}
                    tone="ember"
                  />
                </div>

                <div className="divide-y divide-rule">
                  {audit.findings.map((f) => (
                    <Finding key={f.check} finding={f} />
                  ))}
                  {audit.findings.length === 0 && (
                    <div className="px-5 py-6 text-sm text-ink-soft text-center">
                      Nothing to fix. This account is already well run.
                    </div>
                  )}
                </div>

                <footer className="px-5 py-3 bg-ground border-t border-rule">
                  <p className="text-2xs text-ink-faint">
                    Waste estimates overlap — the same rupee can be caught by more than
                    one finding — so the headline figure is capped rather than summed.
                    Quote it as an estimate, never as a guarantee.
                  </p>
                </footer>
              </article>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

function Figure({
  label, value, tone,
}: {
  label: string
  value: string
  tone?: "ember"
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div
        className={`num text-xl font-semibold mt-1 ${
          tone === "ember" ? "text-ember-dark" : ""
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function Finding({ finding }: { finding: AuditFinding }) {
  const tone = {
    high: "bg-alert-soft text-alert border-alert/25",
    medium: "bg-amber-soft text-amber border-amber/25",
    low: "bg-ground text-ink-soft border-rule",
  }[finding.severity]

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-medium text-sm">{finding.title}</span>
          <span
            className={`px-1.5 py-0.5 text-2xs uppercase tracking-[0.1em] font-medium border ${tone}`}
          >
            {finding.severity}
          </span>
          {finding.confidence === "low" && (
            <span className="text-2xs text-ink-faint">rough estimate</span>
          )}
        </div>
        {finding.estimatedMonthlyWaste > 0 && (
          <span className="num text-sm font-medium text-ember-dark">
            {inr(finding.estimatedMonthlyWaste)}/mo
          </span>
        )}
      </div>
      <p className="text-sm text-ink-soft mt-1.5">{finding.finding}</p>
      <p className="text-sm mt-1.5">
        <span className="text-ink-faint">Fix: </span>
        {finding.recommendation}
      </p>
    </div>
  )
}
