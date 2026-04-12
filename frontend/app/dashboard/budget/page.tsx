export default function BudgetPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">
              Budget Manager
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Spend controls for Google and Meta
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Set monthly caps, track spend, and pause campaigns before budgets
              overshoot.
            </p>
          </div>
          <button className="rounded-2xl bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
            Pause all campaigns
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {[
          {
            platform: "Google Ads",
            cap: "₹1,00,000",
            used: 75000,
            progress: "75%",
            status: "On track",
          },
          {
            platform: "Meta Ads",
            cap: "₹80,000",
            used: 62000,
            progress: "78%",
            status: "Warning",
          },
        ].map((item) => (
          <div
            key={item.platform}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
                  {item.platform}
                </p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {item.cap}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                {item.status}
              </span>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Used</span>
                <span>{item.used.toLocaleString("en-IN")}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[78%] rounded-full bg-brand-600" />
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Remaining</span>
                <span>
                  {item.cap.replace("₹", "₹ ")}•{" "}
                  {100 - Number(item.progress.replace("%", ""))}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Alert preferences</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {["Email at 75%", "Email + SMS at 95%", "Notify on disconnect"].map(
            (option) => (
              <div
                key={option}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-sm font-semibold text-slate-900">{option}</p>
                <p className="mt-3 text-sm text-slate-600">Enabled</p>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
