import Link from "next/link"

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Campaigns", href: "/dashboard/campaigns" },
  { label: "Leads", href: "/dashboard/leads" },
  { label: "Budget", href: "/dashboard/budget" },
  { label: "Reports", href: "/dashboard/reports" },
  { label: "Settings", href: "/dashboard/settings" },
]

export default function Sidebar() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">
          AI Ad Manager
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Manage your dealership ad campaigns, leads, budgets, and reports from
          one place.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Navigation</p>
        <div className="mt-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Ready to launch</p>
        <p className="mt-3 text-sm text-slate-600">
          Connect your Google Ads and Meta accounts to start seeing live
          performance data.
        </p>
        <button className="mt-5 w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
          Connect accounts
        </button>
      </div>
    </div>
  )
}
