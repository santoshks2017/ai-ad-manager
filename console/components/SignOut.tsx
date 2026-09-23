"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { signOut } from "firebase/auth"
import { clientAuth, firebaseConfigured } from "@/lib/firebase-client"

export function SignOut() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function out() {
    setBusy(true)
    try {
      // Clear the server cookie first — if only the client signs out, a stolen
      // cookie would still work.
      await fetch("/api/auth/session", { method: "DELETE" })
      if (firebaseConfigured()) await signOut(clientAuth()).catch(() => {})
      router.push("/signin")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={out}
      disabled={busy}
      className="text-2xs uppercase tracking-[0.1em] font-medium text-ink-soft
                 hover:text-ink border border-rule px-2 py-1.5"
    >
      {busy ? "…" : "Sign out"}
    </button>
  )
}
