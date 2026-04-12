export default function CampaignsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">
              Campaigns
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Active campaigns
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Review live campaign performance and pause or resume activity in
              one place.
            </p>
          </div>
          <button className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
            Launch new campaign
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4">Campaign</th>
                <th className="px-6 py-4">Platform</th>
                <th className="px-6 py-4">Spend</th>
                <th className="px-6 py-4">Leads</th>
                <th className="px-6 py-4">CPL</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[
                {
                  name: "Diwali Exchange Offer",
                  platform: "Google + Meta",
                  spend: "₹45,000",
                  leads: 58,
                  cpl: "₹775",
                  status: "Active",
                },
                {
                  name: "Test Drive Weekend",
                  platform: "Meta",
                  spend: "₹22,400",
                  leads: 24,
                  cpl: "₹933",
                  status: "Active",
                },
                {
                  name: "Creta Model Launch",
                  platform: "Google",
                  spend: "₹29,100",
                  leads: 36,
                  cpl: "₹808",
                  status: "Paused",
                },
              ].map((campaign) => (
                <tr key={campaign.name} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {campaign.name}
                  </td>
                  <td className="px-6 py-4">{campaign.platform}</td>
                  <td className="px-6 py-4">{campaign.spend}</td>
                  <td className="px-6 py-4">{campaign.leads}</td>
                  <td className="px-6 py-4">{campaign.cpl}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${campaign.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
