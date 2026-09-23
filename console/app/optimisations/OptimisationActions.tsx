"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type Outcome =
  | { applied: true; note: string }
  | { applied: false; reason: string; note: string; retryAfterMinutes?: number }

export function OptimisationActions({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function decide(status: "approved" | "rejected") {
    setBusy(true)
    setOutcome(null)
    try {
      const res = await fetch(`/api/optimisations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (status === "approved" && data.outcome) setOutcome(data.outcome)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (outcome) {
    return (
      <div className="shrink-0 max-w-xs text-sm">
        <div
          className={`px-3 py-2 border ${
            outcome.applied
              ? "bg-signal-soft border-signal/20 text-signal"
              : "bg-amber-soft border-amber/25 text-amber"
          }`}
        >
          <span className="font-medium">
            {outcome.applied ? "Applied" : "Approved, not applied"}
          </span>
          <span className="block text-ink-soft mt-0.5 text-2xs">{outcome.note}</span>
          {!outcome.applied && outcome.retryAfterMinutes !== undefined && (
            <span className="block text-ink-soft mt-0.5 text-2xs">
              Retry in about {outcome.retryAfterMinutes} minutes.
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button className="btn-quiet" onClick={() => decide("rejected")} disabled={busy}>
        Skip
      </button>
      <button className="btn-primary" onClick={() => decide("approved")} disabled={busy}>
        {busy ? "Applying…" : "Apply"}
      </button>
    </div>
  )
}
