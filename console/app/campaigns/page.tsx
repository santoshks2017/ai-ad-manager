import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { inr, inrShort, num, relativeDate } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function Campaigns() {
  const store = await getStore()
  const [campaigns, dealers, metrics] = await Promise.all([
    store.listCampaigns(),
    store.listDealers(),
    store.listMetrics(),
  ])

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const byCampaign = new Map<string, { spend: number; leads: number; clicks: number }>()
  for (const m of metrics.filter((x) => x.date >= since)) {
    if (!m.campaignId) continue
    const acc = byCampaign.get(m.campaignId) ?? { spend: 0, leads: 0, clicks: 0 }
    acc.spend += m.spend
    acc.leads += m.leads
    acc.clicks += m.clicks
    byCampaign.set(m.campaignId, acc)
  }

  const dealerFor = (id: string) => dealers.find((d) => d.id === id)

  return (
    <Shell title="Campaigns" subtitle="Everything running across Google and Meta">
      <div className="sheet overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left">
              {["Campaign", "Dealer", "Platform", "Daily budget", "Spend 30d", "Leads", "CPL", "Status"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-2 eyebrow font-medium bg-ground ${i >= 3 && i <= 6 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const agg = byCampaign.get(c.id)
              const cpl = agg && agg.leads > 0 ? agg.spend / agg.leads : null
              const dealer = dealerFor(c.dealerId)
              const over = cpl && dealer?.committedCpl ? cpl > dealer.committedCpl : false
              return (
                <tr key={c.id} className="sheet-row hover:bg-ground">
                  <td className="px-3 py-2.5">
                    <div className="num text-2xs">{c.name}</div>
                    <div className="text-2xs text-ink-faint mt-0.5">
                      created {relativeDate(c.createdAt)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{dealer?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 capitalize">{c.platform}</td>
                  <td className="px-3 py-2.5 text-right num">{inr(c.dailyBudget)}</td>
                  <td className="px-3 py-2.5 text-right num">
                    {agg ? inrShort(agg.spend) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right num">{agg ? num(agg.leads) : "—"}</td>
                  <td
                    className={`px-3 py-2.5 text-right num font-medium ${over ? "text-alert" : ""}`}
                  >
                    {cpl ? inr(cpl) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 text-2xs uppercase tracking-[0.1em]
                                     font-medium bg-signal-soft text-signal border border-signal/20">
                      {c.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}
