"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function OptimisationActions({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function decide(status: "approved" | "rejected") {
    setBusy(true)
    await fetch(`/api/optimisations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button className="btn-quiet" onClick={() => decide("rejected")} disabled={busy}>
        Skip
      </button>
      <button className="btn-primary" onClick={() => decide("approved")} disabled={busy}>
        {busy ? "Working…" : "Apply"}
      </button>
    </div>
  )
}
