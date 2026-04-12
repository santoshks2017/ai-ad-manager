export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">
              Settings
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Connect ad accounts
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Link your Google Ads and Meta Ads accounts, and manage connection
              status from one screen.
            </p>
          </div>
          <button className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
            Connect Google Ads
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {[
          {
            name: "Google Ads",
            status: "Not connected",
            description:
              "Connect to import spend, campaigns and leads from Google.",
          },
          {
            name: "Meta Ads",
            status: "Not connected",
            description:
              "Connect to import lead ads, campaign results and budgets from Meta.",
          },
        ].map((account) => (
          <div
            key={account.name}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {account.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {account.description}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                {account.status}
              </span>
            </div>
            <div className="mt-6 text-sm text-slate-600">
              Once connected, your ad accounts will sync automatically and show
              live metrics in the dashboard.
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
