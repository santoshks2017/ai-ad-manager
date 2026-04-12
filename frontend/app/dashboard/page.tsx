import Link from "next/link"

const metrics = [
  { label: "Total Spend", value: "₹1,24,500", note: "7.4% increase" },
  { label: "Total Leads", value: "138", note: "+12 vs last week" },
  { label: "Cost per Lead", value: "₹900", note: "-9% improvement" },
  { label: "Active Campaigns", value: "4", note: "2 paused" },
]

const campaigns = [
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
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand-700">
              Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              Ads performance at a glance
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Unified Google Ads and Meta Ads performance, campaign health, and
              lead velocity for your dealership.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard/campaigns"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              View campaigns
            </Link>
            <Link
              href="/dashboard/leads"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Open lead inbox
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">
              {metric.value}
            </p>
            <p className="mt-3 text-sm text-brand-600">{metric.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Spend split</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Google vs Meta
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              Last 7 days
            </span>
          </div>
          <div className="mt-8 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                <span>Google</span>
                <span>65%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[65%] rounded-full bg-brand-600" />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                <span>Meta</span>
                <span>35%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[35%] rounded-full bg-slate-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Lead velocity</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            New leads this week
          </h2>
          <p className="mt-4 text-5xl font-semibold text-slate-900">42</p>
          <p className="mt-3 text-sm text-slate-600">
            Leads are rising steadily after the latest festive campaign.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Top campaigns</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              Campaign performance
            </h2>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            View all campaigns →
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {campaigns.map((item) => (
            <div key={item.name} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {item.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{item.platform}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-slate-500">Spend</p>
                    <p className="text-base font-semibold text-slate-900">
                      {item.spend}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Leads</p>
                    <p className="text-base font-semibold text-slate-900">
                      {item.leads}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">CPL</p>
                    <p className="text-base font-semibold text-slate-900">
                      {item.cpl}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-white px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
