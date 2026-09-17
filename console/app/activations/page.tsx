import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { inr, relativeDate } from "@/lib/format"
import { ActivationActions } from "./ActivationActions"

export const dynamic = "force-dynamic"

export default async function Activations() {
  const store = await getStore()
  const [orders, dealers, users] = await Promise.all([
    store.listOrders(),
    store.listDealers(),
    store.listUsers(),
  ])

  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? "Unknown dealer"
  const userName = (id: string | null) =>
    id ? (users.find((u) => u.id === id)?.name ?? id) : "—"

  const waiting = orders.filter((o) => o.status === "submitted")
  const settled = orders.filter((o) => o.status !== "submitted")

  return (
    <Shell
      title="Activations"
      subtitle="Orders sales has confirmed, waiting for campaigns to be set up"
    >
      {waiting.length === 0 ? (
        <div className="sheet p-10 text-center">
          <div className="font-display font-bold text-lg">Nothing waiting</div>
          <p className="text-sm text-ink-soft mt-2">
            When sales confirms an order with a dealer, it lands here for setup.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {waiting.map((o) => {
            const dealer = dealers.find((d) => d.id === o.dealerId)
            const notReady =
              dealer &&
              (!dealer.platform?.servicesAgreementSigned ||
                dealer.platform?.googleState !== "ready" ||
                dealer.platform?.metaState !== "ready")
            return (
              <div key={o.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-base">
                      {dealerName(o.dealerId)}
                    </div>
                    <div className="text-sm text-ink-soft mt-0.5">
                      {dealer?.city} · submitted by {userName(o.submittedBy)}{" "}
                      {relativeDate(o.submittedAt)}
                    </div>
                    {o.notes && (
                      <p className="text-sm text-ink-soft mt-2 max-w-xl">{o.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <Figure label="Budget" value={inr(o.budget)} />
                    <Figure
                      label="Committed CPL"
                      value={o.committedCpl ? inr(o.committedCpl) : "Not set"}
                    />
                    <ActivationActions orderId={o.id} />
                  </div>
                </div>

                {notReady && (
                  <div className="mt-4 px-3 py-2.5 bg-amber-soft border border-amber/25 text-sm">
                    <span className="font-medium text-amber">
                      Platform accounts are not ready.
                    </span>{" "}
                    <span className="text-ink-soft">
                      {!dealer?.platform?.servicesAgreementSigned &&
                        "The services agreement is unsigned — it is what authorises us to run ads as this dealer's representative. "}
                      {dealer?.platform?.googleState !== "ready" &&
                        "Google client account still to be created. "}
                      {dealer?.platform?.metaState !== "ready" &&
                        "Meta Page, Business Portfolio and ad account still to be created."}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="eyebrow mb-3">Settled</div>
      <div className="sheet overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left">
              {["Dealer", "Budget", "Committed CPL", "Status", "Decided by", "When"].map(
                (h) => (
                  <th key={h} className="px-3 py-2 eyebrow font-medium bg-ground">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {settled.map((o) => (
              <tr key={o.id} className="sheet-row">
                <td className="px-3 py-2.5 font-medium">{dealerName(o.dealerId)}</td>
                <td className="px-3 py-2.5 num">{inr(o.budget)}</td>
                <td className="px-3 py-2.5 num">
                  {o.committedCpl ? inr(o.committedCpl) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`px-2 py-0.5 text-2xs uppercase tracking-[0.1em] font-medium border ${
                      o.status === "activated"
                        ? "bg-signal-soft text-signal border-signal/20"
                        : "bg-ground text-ink-faint border-rule"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-ink-soft">{userName(o.activatedBy)}</td>
                <td className="px-3 py-2.5 text-ink-soft">
                  {o.activatedAt ? relativeDate(o.activatedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num text-lg font-semibold mt-0.5">{value}</div>
    </div>
  )
}
