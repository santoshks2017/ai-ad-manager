import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <div className="mb-10 flex flex-col gap-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
              AI Ad Manager
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              Manage Google & Meta campaigns for your car dealership from one
              dashboard.
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Launch template-based campaigns, track leads in one inbox, and
              control budgets without an agency.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Sign in with Google
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">
                What you get
              </h2>
              <ul className="mt-4 space-y-3 text-slate-600">
                <li>• Unified Google + Meta dashboard</li>
                <li>• Campaign launcher with auto templates</li>
                <li>• Lead inbox with status tracking</li>
                <li>• Budget caps and alerts</li>
                <li>• Weekly performance reports</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
