/** Indian-format helpers. Lakh/crore grouping, not thousands separators. */

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN")
}

/** Compact Indian scale — ₹1.4L, ₹2.3Cr. For dense table cells. */
export function inrShort(n: number): string {
  const v = Math.abs(n)
  if (v >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`
  if (v >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (v >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("en-IN")
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  return shortDate(iso)
}
