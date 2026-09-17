/**
 * The signature element: CPL reconciliation.
 *
 * This whole business turns on one question — did we deliver leads at the
 * price we committed to? So every dealer row carries a single instrument
 * showing actual CPL against the committed CPL: a tick at the promise, a bar
 * at the reality. Scanning a book of fifty dealers, the ones underwater are
 * immediately obvious without reading a single number.
 */

export function CplBar({
  actual,
  committed,
  width = 140,
}: {
  actual: number
  committed: number | null
  width?: number
}) {
  // Scale so the committed mark sits at 60% of the track. That leaves visible
  // headroom to overshoot into without the bar instantly pinning at full.
  const scaleMax = committed ? committed / 0.6 : actual * 1.6
  const actualPct = Math.min(100, (actual / scaleMax) * 100)
  const committedPct = committed ? (committed / scaleMax) * 100 : null

  const over = committed !== null && actual > committed
  const near = committed !== null && !over && actual > committed * 0.9

  const barColor = over
    ? "bg-alert"
    : near
      ? "bg-amber"
      : "bg-signal"

  const label = committed === null
    ? "No committed CPL set"
    : over
      ? `₹${Math.round(actual)} against ₹${committed} committed — over by ${Math.round(((actual - committed) / committed) * 100)}%`
      : `₹${Math.round(actual)} against ₹${committed} committed — under by ${Math.round(((committed - actual) / committed) * 100)}%`

  return (
    <div
      className="relative h-4 bg-ground border border-rule"
      style={{ width }}
      title={label}
      role="img"
      aria-label={label}
    >
      <div
        className={`absolute inset-y-0 left-0 ${barColor}`}
        style={{ width: `${actualPct}%` }}
      />
      {committedPct !== null && (
        <div
          className="absolute inset-y-0 w-px bg-ink"
          style={{ left: `${Math.min(100, committedPct)}%` }}
        />
      )}
    </div>
  )
}
