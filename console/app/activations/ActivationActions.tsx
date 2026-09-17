"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function ActivationActions({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function decide(status: "activated" | "rejected") {
    setBusy(true)
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex gap-2">
      <button
        className="btn-quiet"
        onClick={() => decide("rejected")}
        disabled={busy}
      >
        Send back
      </button>
      <button
        className="btn-primary"
        onClick={() => decide("activated")}
        disabled={busy}
      >
        {busy ? "Working…" : "Activate"}
      </button>
    </div>
  )
}
