"use client"

import { useState } from "react"

/**
 * The stop button.
 *
 * Deliberately two-step. Pausing every campaign across every showroom is not
 * something to do by misclick, and the confirmation names how many campaigns
 * it will actually touch.
 */
export function PauseAll({ activeCount }: { activeCount: number }) {
  const [confirming, setConfirming] = useState(false)

  if (activeCount === 0) return null

  if (!confirming) {
    return (
      <button className="btn-quiet" onClick={() => setConfirming(true)}>
        Pause everything
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-soft">
        Pause all {activeCount} live campaigns?
      </span>
      <button className="btn-quiet" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button
        className="btn bg-alert text-white hover:bg-[#8d2b19] px-4 h-10 rounded-md text-sm font-medium"
        disabled
        title="Needs the platform apply queue, which is not built yet"
      >
        Pause
      </button>
    </div>
  )
}
