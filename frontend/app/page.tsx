import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white selection:bg-brand-500 selection:text-black overflow-hidden relative">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-brand-500/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24 relative z-10 flex flex-col justify-between min-h-screen">
        
        {/* Navigation / Brand Header */}
        <header className="flex justify-between items-center pb-12 border-b border-slate-900">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              AI Ad Manager
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 px-5 py-2 text-xs font-semibold tracking-wider uppercase transition"
          >
            Sign In
          </Link>
        </header>

        {/* Hero Section */}
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] items-center py-12 lg:py-20">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/5 px-3 py-1 text-xs font-medium text-brand-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              India's first dealer-first ad platform
            </div>
            
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1] text-slate-100">
              Control your dealership ads, <br />
              <span className="bg-gradient-to-r from-brand-300 via-brand-500 to-emerald-400 bg-clip-text text-transparent">
                without an agency.
              </span>
            </h1>
            
            <p className="text-base text-slate-400 leading-relaxed max-w-lg">
              Launch pre-built auto campaigns on Google & Meta in one click. Capture all leads in a unified inbox and set monthly budget safeguards. Designed for Dealer Principals.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-8 py-4.5 text-sm font-bold text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-500 hover:scale-[1.02] active:scale-100"
              >
                Start Free Sandbox Demo
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-8 py-4.5 text-sm font-bold text-slate-300 transition"
              >
                Watch 2min Demo
              </Link>
            </div>
          </div>

          {/* Interactive Feature Display (Premium Glass Card) */}
          <div className="rounded-3xl border border-slate-850 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-24 w-24 bg-brand-500/10 blur-2xl rounded-full" />
            
            <h2 className="text-lg font-bold text-slate-100 mb-6">
              What you get in the MVP
            </h2>
            
            <div className="space-y-5">
              {[
                { title: "Unified Google + Meta dashboard", desc: "Compare spend and leads in a single view." },
                { title: "One-click campaign templates", desc: "Diwali clearance, exchange bonuses pre-written." },
                { title: "Unified lead inbox", desc: "Filter and call leads directly from your mobile." },
                { title: "Budget caps & emergency pause", desc: "Never overshoot your monthly marketing budget." },
                { title: "Weekly reports", desc: "Plain English summaries sent to your email every Monday." }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-4 items-start">
                  <div className="h-5 w-5 bg-brand-900/30 text-brand-400 text-xs rounded-full flex items-center justify-center font-bold shrink-0 border border-brand-500/10 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600">
          <p>© 2026 AI Ad Manager. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-slate-400 transition">Terms of Service</Link>
            <Link href="/" className="hover:text-slate-400 transition">Privacy Policy</Link>
            <Link href="/" className="hover:text-slate-400 transition">Contact Support</Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
