import { Suspense } from "react"
import { SignInForm } from "./SignInForm"
import { firebaseClientConfig } from "@/lib/firebase-config"

export const dynamic = "force-dynamic"

export default function SignIn() {
  const config = firebaseClientConfig()
  return (
    <div className="min-h-screen bg-ground flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-lg object-contain shadow-sm" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-extrabold text-base tracking-tight">
                CarDekho
              </span>
              <span className="text-[9px] font-bold bg-surface text-ink-soft border border-rule rounded px-1 py-px uppercase">
                NCBD
              </span>
            </div>
            <div className="eyebrow mt-0.5">AdManager Console</div>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="font-display font-bold text-lg">Sign in</h1>
          <p className="text-sm text-ink-soft mt-1 mb-5">
            For the account management and sales teams.
          </p>
          <Suspense fallback={null}>
            <SignInForm config={config} />
          </Suspense>
        </div>

        <p className="text-2xs text-ink-faint mt-5">
          Showrooms do not sign in here. They get a direct link for connecting their
          own ad accounts.
        </p>
      </div>
    </div>
  )
}
