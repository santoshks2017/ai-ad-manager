"use client"

import { useState } from "react"

/**
 * Chart primitives.
 *
 * Deliberately no charting library: these are small, the bundle stays light,
 * and inline SVG lets the marks follow the same rules as the rest of the
 * console. Data-mark colours come from the `viz` tokens, which are validated
 * separately from the UI colours — the UI greens and navies pass text contrast
 * but read muddy as large fills.
 *
 * No chart here uses two y-axes. Where two measures have different scales they
 * get two charts, never one with a second axis.
 */

export interface Point {
  date: string
  value: number | null
}

/**
 * Single-series line with a hover crosshair.
 *
 * One series means no legend — the title names it. Values are labelled at the
 * ends and on hover rather than on every point.
 */
export type NumberFormat = "inr" | "inrShort" | "count"

/**
 * Formatting lives inside the client boundary because a Server Component
 * cannot hand a function to a Client Component — it has to pass a name.
 */
function fmt(kind: NumberFormat, n: number): string {
  if (kind === "count") return String(Math.round(n))
  if (kind === "inrShort") {
    const v = Math.abs(n)
    if (v >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`
    if (v >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
    if (v >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  }
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

export function LineChart({
  points,
  label,
  format,
  height = 180,
}: {
  points: Point[]
  label: string
  format: NumberFormat
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const f = (n: number) => fmt(format, n)

  const real = points.filter((p) => p.value !== null) as { date: string; value: number }[]
  if (real.length < 2) {
    return (
      <div
        className="sheet flex items-center justify-center text-sm text-ink-soft"
        style={{ height }}
      >
        Not enough data yet to plot {label.toLowerCase()}.
      </div>
    )
  }

  const W = 720
  const H = height
  const PAD = { top: 16, right: 16, bottom: 26, left: 52 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const values = real.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // Pad the domain so the line never sits on the frame.
  const lo = min - (max - min || min || 1) * 0.15
  const hi = max + (max - min || min || 1) * 0.15

  const x = (i: number) => PAD.left + (i / (real.length - 1)) * innerW
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH

  const path = real.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ")

  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1]

  return (
    <div className="sheet p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label} over time, ${real.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
              stroke="#D5DAD8" strokeWidth={1}
            />
            <text
              x={PAD.left - 8} y={y(t) + 3} textAnchor="end"
              className="num" fontSize={10} fill="#8A9296"
            >
              {f(t)}
            </text>
          </g>
        ))}

        <path d={path} fill="none" stroke="#1E9973" strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />

        {/* Invisible hit targets, wider than the marks. */}
        {real.map((p, i) => (
          <rect
            key={i}
            x={x(i) - innerW / real.length / 2}
            y={PAD.top}
            width={innerW / real.length}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover !== null && (
          <g>
            <line
              x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH}
              stroke="#8A9296" strokeWidth={1} strokeDasharray="3 3"
            />
            {/* Surface ring keeps the marker legible over the line. */}
            <circle cx={x(hover)} cy={y(real[hover].value)} r={5}
                    fill="#1E9973" stroke="#FFFFFF" strokeWidth={2} />
          </g>
        )}

        <text x={PAD.left} y={H - 8} fontSize={10} fill="#8A9296" className="num">
          {real[0].date}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" fontSize={10}
              fill="#8A9296" className="num">
          {real[real.length - 1].date}
        </text>
      </svg>

      <div className="flex items-baseline justify-between px-1 pt-1">
        <span className="eyebrow">{label}</span>
        <span className="num text-sm">
          {hover !== null
            ? `${real[hover].date} · ${f(real[hover].value)}`
            : `latest ${f(real[real.length - 1].value)}`}
        </span>
      </div>
    </div>
  )
}

/**
 * Ranked horizontal bars with a status colour and a direct label.
 *
 * Status is never carried by colour alone — every row shows its value as text,
 * which is also what makes the chart readable in print and forced-colours mode.
 */
export function RankedBars({
  rows,
  format,
}: {
  rows: {
    label: string
    sublabel?: string
    value: number
    display: string
    tone: "good" | "warn" | "bad" | "neutral"
    note?: string
  }[]
  format?: (n: number) => string
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const tones = {
    good: "bg-viz-good",
    warn: "bg-viz-warn",
    bad: "bg-viz-bad",
    neutral: "bg-rule-strong",
  }

  return (
    <div className="sheet">
      {rows.map((r, i) => (
        <div key={i} className="sheet-row first:border-t-0 px-4 py-3">
          <div className="flex items-baseline justify-between gap-4 mb-1.5">
            <div className="min-w-0">
              <span className="text-sm font-medium">{r.label}</span>
              {r.sublabel && (
                <span className="text-2xs text-ink-faint ml-2">{r.sublabel}</span>
              )}
            </div>
            <span className="num text-sm font-medium shrink-0">{r.display}</span>
          </div>
          <div className="h-2 bg-ground border border-rule relative">
            <div
              className={`absolute inset-y-0 left-0 ${tones[r.tone]}`}
              style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }}
            />
          </div>
          {r.note && <div className="text-2xs text-ink-faint mt-1">{r.note}</div>}
        </div>
      ))}
      {rows.length === 0 && (
        <div className="p-8 text-center text-sm text-ink-soft">Nothing to show yet.</div>
      )}
    </div>
  )
}

/** Progress toward a budget, with a marker at the point spend should have reached. */
export function PacingBar({
  spent,
  budget,
  projected,
  elapsedFraction,
}: {
  spent: number
  budget: number
  projected: number
  elapsedFraction: number
}) {
  const spentPct = Math.min(100, (spent / budget) * 100)
  const projectedPct = Math.min(100, (projected / budget) * 100)
  const over = projected > budget * 1.05
  const under = projected < budget * 0.85

  return (
    <div className="h-4 bg-ground border border-rule relative">
      <div
        className={`absolute inset-y-0 left-0 ${
          over ? "bg-viz-bad" : under ? "bg-viz-warn" : "bg-viz-good"
        }`}
        style={{ width: `${spentPct}%` }}
      />
      {/* Where spend would be if it were pacing exactly to budget. */}
      <div
        className="absolute inset-y-0 w-px bg-ink"
        style={{ left: `${Math.min(100, elapsedFraction * 100)}%` }}
        title="Where spend should be today"
      />
      {projectedPct > spentPct && (
        <div
          className="absolute inset-y-0 border-r border-dashed border-ink-faint"
          style={{ left: `${projectedPct}%` }}
          title="Projected month end"
        />
      )}
    </div>
  )
}
