import Link from "next/link"
import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { grantHealth, onboardingProgress, platformAccount } from "@/lib/onboarding"
import { relativeDate } from "@/lib/format"
import { CopyLink } from "./CopyLink"
import { onboardToken } from "@/lib/onboard-link"

export const dynamic = "force-dynamic"

export default async function Onboarding() {
  const store = await getStore()
  const dealers = await store.listDealers()

  // Goes through platformAccount so records written before ownership existed
  // are read as agency-owned rather than throwing.
  const delegated = dealers.filter(
    (d) =>
      platformAccount(d, "google").ownership === "dealer_linked" ||
      platformAccount(d, "meta").ownership === "dealer_linked",
  )
  const needsAttention = grantHealth(dealers)

  return (
    <Shell
      title="Onboarding"
      subtitle="Dealers connecting their own ad accounts to us"
    >
      <div className="card p-4 mb-6 text-sm text-ink-soft max-w-3xl">
        <span className="font-medium text-ink">
          Where a dealer owns their accounts, some steps can only be done by them.
        </span>{" "}
        Meta ad accounts cannot be moved between business portfolios — ownership is
        permanent to whoever creates it — so if we create it, the dealer can never take
        it with them. Google requires the client to accept a manager link from their own
        account. Send the link, then do it with them on the phone.
      </div>

      {needsAttention.length > 0 && (
        <section className="mb-8">
          <div className="eyebrow mb-3">Needs attention</div>
          <div className="sheet">
            {needsAttention.map((h, i) => (
              <div
                key={`${h.dealer.id}-${h.platform}-${i}`}
                className="sheet-row first:border-t-0 px-4 py-3 flex flex-wrap items-baseline justify-between gap-3"
              >
                <div>
                  <Link href={`/dealers/${h.dealer.id}`} className="font-medium text-sm hover:underline">
                    {h.dealer.name}
                  </Link>
                  <span className="text-2xs text-ink-faint ml-2 capitalize">{h.platform}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-ink-soft">
                    {h.state === "revoked"
                      ? "Access was removed — someone at the dealership revoked it, or the person who granted it has left."
                      : h.state === "expired"
                        ? "The access token has expired and needs renewing."
                        : "Link sent but never completed."}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-2xs uppercase tracking-[0.1em] font-medium border ${
                      h.state === "revoked"
                        ? "bg-alert-soft text-alert border-alert/25"
                        : "bg-amber-soft text-amber border-amber/25"
                    }`}
                  >
                    {h.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="eyebrow mb-3">Delegated dealers</div>
      {delegated.length === 0 ? (
        <div className="sheet p-10 text-center">
          <div className="font-display font-bold text-lg">No delegated dealers yet</div>
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
            Every dealer currently runs on accounts we own. Switch a dealer to
            dealer-linked to have them connect their own.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {delegated.map((d) => {
            const p = onboardingProgress(d)
            return (
              <div key={d.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/dealers/${d.id}`} className="font-display font-bold text-base hover:underline">
                      {d.name}
                    </Link>
                    <div className="text-sm text-ink-soft mt-0.5">
                      {d.city} · {p.done} of {p.total} steps done
                    </div>
                    {p.nextStep && (
                      <div className="text-sm text-ink-soft mt-2">
                        <span className="font-medium text-ink">Next:</span>{" "}
                        {p.nextStep.title} — {p.nextStep.dealerAction}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <CopyLink token={onboardToken(d.id)} dealerName={d.name} />
                  </div>
                </div>

                <div className="mt-4 h-1.5 bg-ground border border-rule">
                  <div
                    className={p.complete ? "h-full bg-viz-good" : "h-full bg-viz-warn"}
                    style={{ width: `${p.total > 0 ? (p.done / p.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}
