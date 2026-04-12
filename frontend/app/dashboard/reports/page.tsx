export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">
              Reports
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Weekly performance summary
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Send or review the latest report with campaign insights and cost
              per lead metrics.
            </p>
          </div>
          <button className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
            Send latest report
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {[
          {
            period: "Mon 8 Apr – Sun 14 Apr",
            spend: "₹1,24,500",
            leads: 138,
            cpl: "₹900",
          },
          {
            period: "Mon 1 Apr – Sun 7 Apr",
            spend: "₹1,12,000",
            leads: 121,
            cpl: "₹925",
          },
          {
            period: "Mon 25 Mar – Sun 31 Mar",
            spend: "₹1,05,300",
            leads: 113,
            cpl: "₹932",
          },
        ].map((report) => (
          <div
            key={report.period}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-500">
              {report.period}
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">
              {report.spend}
            </p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-slate-900">Leads</p>
                <p>{report.leads}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">CPL</p>
                <p>{report.cpl}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Weekly insight</p>
        <p className="mt-4 text-lg font-semibold text-slate-900">
          Your exchange offer campaign delivered 18% lower CPL than last week.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Send this report to the Dealer Principal with one click or download a
          PDF summary for sharing.
        </p>
      </div>
    </div>
  )
}
