"use client"

import Link from "next/link"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
            Dealer login
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Sign in and connect your ad accounts
          </h1>
          <p className="text-slate-600">
            One click Google login plus guided onboarding for Google Ads and
            Meta Ads.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          <button
            type="button"
            onClick={() => signIn("google")}
            className="w-full rounded-2xl bg-brand-600 px-5 py-4 text-base font-semibold text-white transition hover:bg-brand-700"
          >
            Sign in with Google
          </button>
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Continue with email
          </button>
        </div>

        <div className="mt-10 text-center text-sm text-slate-500">
          <p>
            Need help?{" "}
            <Link
              href="/"
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
