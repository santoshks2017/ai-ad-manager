"use client"

import Link from "next/link"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSandboxBypass = () => {
    // In sandbox dev mode, we can directly redirect the user to the dashboard
    // since the API auth middleware automatically handles mock users for requests without tokens!
    setLoading(true)
    setTimeout(() => {
      router.push("/dashboard")
    }, 600)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white relative">
      {/* Decorative Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-brand-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md rounded-3xl border border-slate-900 bg-slate-900/40 p-10 shadow-2xl backdrop-blur-md relative z-10 space-y-8">
        
        {/* Brand/Logo */}
        <div className="space-y-3 text-center">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-400 hover:text-brand-300 transition">
            ← AI Ad Manager
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">
            Welcome to Dealer Console
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            Connect your Google and Meta accounts to start running campaigns and managing leads.
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full rounded-2xl bg-brand-600 px-5 py-4 text-xs font-bold text-white transition hover:bg-brand-500 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-100 shadow-md shadow-brand-950/20"
          >
            🔑 Sign in with Google Account
          </button>
          
          <button
            type="button"
            onClick={handleSandboxBypass}
            disabled={loading}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 px-5 py-4 text-xs font-bold text-slate-300 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-slate-500 border-t-white" />
                Launching Sandbox...
              </>
            ) : (
              "🧪 Launch Sandbox Dev Mode"
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-600 pt-4 border-t border-slate-900 leading-relaxed">
          <p>By signing in, you authorize AI Ad Manager to read campaign reporting structures and synchronize lead forms from linked profiles.</p>
          <p className="mt-3 font-medium text-slate-500">Need help? <Link href="/" className="text-brand-500 hover:underline">Contact Support</Link></p>
        </div>
      </div>
    </main>
  )
}
