"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { clientAuth, isConfigured, type FirebaseClientConfig } from "@/lib/firebase-client"

export function SignInForm({ config }: { config: FirebaseClientConfig | null }) {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isConfigured(config)) {
    return (
      <div className="px-4 py-3 bg-amber-soft border border-amber/25 text-sm">
        <span className="font-medium text-amber">Sign-in is not configured.</span>{" "}
        <span className="text-ink-soft">
          Set FIREBASE_API_KEY and FIREBASE_PROJECT_ID on the service.
        </span>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isConfigured(config)) return
    setBusy(true)
    setError(null)
    try {
      const cred = await signInWithEmailAndPassword(clientAuth(config), email, password)
      const idToken = await cred.user.getIdToken()

      // Trade the ID token for an httpOnly session cookie. The ID token itself
      // is never persisted in the browser.
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Could not start a session.")
      }
      router.push(next)
      router.refresh()
    } catch (err) {
      const code = (err as { code?: string }).code
      // Firebase returns the same code for a wrong password and an unknown
      // account, which is correct — telling someone an email exists is a
      // free user-enumeration oracle.
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password" ||
        code === "auth/user-not-found"
          ? "That email and password do not match an account."
          : code === "auth/too-many-requests"
            ? "Too many attempts. Wait a few minutes and try again."
            : (err as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input
          id="email" type="email" autoComplete="username" required
          className="field" value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password" type="password" autoComplete="current-password" required
          className="field" value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <div className="px-3 py-2.5 bg-alert-soft border border-alert/25 text-sm text-alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}
