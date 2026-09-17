import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { relativeDate } from "@/lib/format"
import { OptimisationActions } from "./OptimisationActions"

export const dynamic = "force-dynamic"

const KIND_LABEL: Record<string, string> = {
  pause_underperformer: "Pause underperformer",
  shift_budget: "Shift budget",
  adjust_bid: "Adjust bid",
  expand_targeting: "Expand targeting",
  refresh_creative: "Refresh creative",
  pacing_correction: "Correct pacing",
}

export default async function Optimisations() {
  const store = await getStore()
  const [all, dealers] = await Promise.all([
    store.listOptimizations(),
    store.listDealers(),
  ])

  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "Unknown"
  const proposed = all.filter((o) => o.status === "proposed")
  const decided = all.filter((o) => o.status !== "proposed")

  return (
    <Shell
      title="Optimisations"
      subtitle="What the system wants to change, and why"
    >
      <div className="card p-4 mb-6 text-sm text-ink-soft">
        <span className="font-medium text-ink">The system watches continuously; it
        does not change things continuously.</span>{" "}
        Meta caps ad-set budget changes at four an hour and spend changes at ten a day,
        and frequent adjustments fight the platforms' own optimisation rather than
        helping it. So changes are batched and, where they touch budget, targeting or
        creative, they wait for you.
      </div>

      {proposed.length === 0 ? (
        <div className="sheet p-10 text-center">
          <div className="font-display font-bold text-lg">Nothing to review</div>
          <p className="text-sm text-ink-soft mt-2">
            No campaign currently needs a change. This is the normal state.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {proposed.map((o) => (
            <div key={o.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-display font-bold text-base">
                      {KIND_LABEL[o.kind] ?? o.kind}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {dealerName(o.dealerId)}
                    </span>
                    {o.requiresApproval ? (
                      <span className="px-2 py-0.5 text-2xs uppercase tracking-[0.1em]
                                       font-medium bg-amber-soft text-amber border border-amber/25">
                        Needs your call
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-2xs uppercase tracking-[0.1em]
                                       font-medium bg-signal-soft text-signal border border-signal/20">
                        Safe to auto-apply
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink-soft mt-2.5 max-w-3xl">{o.rationale}</p>
                  <div className="text-2xs text-ink-faint mt-2.5 num">
                    Proposed {relativeDate(o.createdAt)} · reversible
                  </div>
                </div>
                <OptimisationActions id={o.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <>
          <div className="eyebrow mb-3">Recently decided</div>
          <div className="sheet">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {["Change", "Dealer", "Outcome", "When"].map((h) => (
                    <th key={h} className="px-3 py-2 eyebrow font-medium bg-ground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decided.map((o) => (
                  <tr key={o.id} className="sheet-row">
                    <td className="px-3 py-2.5">{KIND_LABEL[o.kind] ?? o.kind}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{dealerName(o.dealerId)}</td>
                    <td className="px-3 py-2.5">{o.status}</td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      {o.decidedAt ? relativeDate(o.decidedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  )
}
