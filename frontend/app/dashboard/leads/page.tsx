export default function LeadsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">
              Leads
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Unified lead inbox
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              All Google and Meta leads in one place with status, campaign
              attribution, and notes.
            </p>
          </div>
          <button className="rounded-2xl bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-500">New leads</p>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              12 new
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {[
              {
                name: "Mr. Kumar",
                phone: "+91 98765 43210",
                source: "Google",
                campaign: "Diwali Exchange Offer",
                status: "New",
              },
              {
                name: "Priya Sharma",
                phone: "+91 91234 56789",
                source: "Meta",
                campaign: "Test Drive Weekend",
                status: "Contacted",
              },
              {
                name: "Rohit Singh",
                phone: "+91 99887 66554",
                source: "Google",
                campaign: "Creta Model Launch",
                status: "Qualified",
              },
            ].map((lead) => (
              <div
                key={lead.phone}
                className="rounded-3xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {lead.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{lead.phone}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {lead.source}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                  <p>{lead.campaign}</p>
                  <p>• {lead.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Lead details</p>
          <div className="mt-6 rounded-3xl bg-slate-50 p-5">
            <p className="text-lg font-semibold text-slate-900">Mr. Kumar</p>
            <p className="mt-2 text-sm text-slate-500">
              Source: Google • Campaign: Diwali Exchange Offer
            </p>
            <div className="mt-5 space-y-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Phone:</span> +91 98765 43210
              </p>
              <p>
                <span className="font-semibold">Status:</span> New
              </p>
              <p>
                <span className="font-semibold">Notes:</span> Interested in test
                drive and exchange offer.
              </p>
            </div>
            <button className="mt-6 inline-flex rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
              Mark as contacted
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
