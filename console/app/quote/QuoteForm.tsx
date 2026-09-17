"use client"

import { useState } from "react"
import { inr, num } from "@/lib/format"
import { OBJECTIVES } from "@/lib/types"
import type { ProjectionOutput } from "@/lib/types"

const CITIES = [
  "Lucknow", "Noida", "Jaipur", "Coimbatore", "Pune", "Indore", "Mumbai",
  "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad",
  "Kanpur", "Nagpur", "Surat", "Patna", "Chandigarh", "Kochi", "Bhopal",
]

const BRANDS = [
  "Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Kia", "Toyota", "Honda",
  "MG", "Skoda", "Volkswagen", "Renault", "Nissan", "BMW", "Mercedes-Benz", "Audi",
]

export function QuoteForm() {
  const [budget, setBudget] = useState(100_000)
  const [city, setCity] = useState("Lucknow")
  const [brand, setBrand] = useState("Hyundai")
  const [model, setModel] = useState("Creta")
  const [objective, setObjective] = useState("leads")
  const [durationDays, setDurationDays] = useState(30)

  const [result, setResult] = useState<ProjectionOutput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget, city, brand, model, objective, durationDays }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not build the quote. Try again.")
        setResult(null)
      } else {
        setResult(data.output)
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-6 items-start">
      <form onSubmit={run} className="card p-5 space-y-4">
        <div>
          <label className="label" htmlFor="budget">Monthly budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint num text-sm">₹</span>
            <input
              id="budget" type="number" min={5000} step={5000} value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="field num pl-7" required
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            {[50_000, 100_000, 200_000, 500_000].map((v) => (
              <button
                key={v} type="button" onClick={() => setBudget(v)}
                className="num text-2xs px-2 py-1 border border-rule hover:bg-ground"
              >
                {v >= 100000 ? `${v / 100000}L` : `${v / 1000}K`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="city">City</label>
          <input
            id="city" list="cities" value={city}
            onChange={(e) => setCity(e.target.value)}
            className="field" required
          />
          <datalist id="cities">
            {CITIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="brand">Brand</label>
            <input
              id="brand" list="brands" value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="field" required
            />
            <datalist id="brands">
              {BRANDS.map((b) => <option key={b} value={b} />)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="model">Model</label>
            <input
              id="model" value={model}
              onChange={(e) => setModel(e.target.value)}
              className="field" required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="objective">Objective</label>
          <select
            id="objective" value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="field"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="duration">Run for (days)</label>
          <input
            id="duration" type="number" min={7} max={365} value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className="field num"
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Working…" : "Build quote"}
        </button>
      </form>

      <div>
        {error && (
          <div className="px-4 py-3 bg-alert-soft border border-alert/25 text-sm text-alert">
            {error}
          </div>
        )}
        {!result && !error && <EmptyState />}
        {result && <QuoteResult output={result} budget={budget} />}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="sheet p-10 text-center">
      <div className="font-display font-bold text-lg">Quote a dealer in seconds</div>
      <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
        Enter the budget, city and model on the left. You will get a CPL range and a
        deliverable lead count you can put in front of a dealer while you are still
        sitting with them.
      </p>
    </div>
  )
}

function QuoteResult({ output, budget }: { output: ProjectionOutput; budget: number }) {
  const conf = {
    high: { label: "High confidence", cls: "bg-signal-soft text-signal border-signal/20" },
    medium: { label: "Medium confidence", cls: "bg-accent-soft text-accent border-accent/20" },
    low: { label: "Low confidence", cls: "bg-amber-soft text-amber border-amber/25" },
  }[output.confidence]

  const basisLabel = {
    historical: `Our own results — ${output.sampleSize} campaign${output.sampleSize === 1 ? "" : "s"}`,
    keyword_api: "Live Google keyword data",
    benchmark: "Category benchmarks",
  }[output.basis]

  return (
    <div className="space-y-5">
      <div className="sheet">
        <div className="px-5 py-3 border-b border-rule flex flex-wrap items-center justify-between gap-3 bg-ground">
          <span className="eyebrow">What we can deliver</span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-2xs uppercase tracking-[0.1em] font-medium border ${conf.cls}`}>
              {conf.label}
            </span>
            <span className="text-2xs text-ink-faint">{basisLabel}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
          <Band
            label="Cost per lead"
            low={inr(output.cplLow)}
            high={inr(output.cplHigh)}
            caption={`on ${inr(budget)} for the month`}
          />
          <Band
            label="Leads delivered"
            low={num(output.leadsLow)}
            high={num(output.leadsHigh)}
            caption="over the campaign period"
          />
        </div>
      </div>

      <div className="sheet">
        <div className="px-5 py-3 border-b border-rule bg-ground">
          <span className="eyebrow">Where the money goes</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              {["Platform", "Share", "Spend", "CPL range", "Leads"].map((h, i) => (
                <th key={h} className={`px-4 py-2 eyebrow font-medium ${i > 1 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.platforms.map((p) => (
              <tr key={p.platform} className="sheet-row">
                <td className="px-4 py-2.5 font-medium capitalize">{p.platform}</td>
                <td className="px-4 py-2.5 num">{Math.round(p.spendShare * 100)}%</td>
                <td className="px-4 py-2.5 num text-right">{inr(p.spend)}</td>
                <td className="px-4 py-2.5 num text-right">
                  {inr(p.cplLow)}–{inr(p.cplHigh)}
                </td>
                <td className="px-4 py-2.5 num text-right">
                  {num(p.leadsLow)}–{num(p.leadsHigh)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {output.notes.length > 0 && (
        <div className="card p-5">
          <div className="eyebrow mb-3">Before you quote this</div>
          <ul className="space-y-2.5">
            {output.notes.map((n, i) => (
              <li key={i} className="text-sm text-ink-soft flex gap-2.5">
                <span className="text-ink-faint shrink-0 mt-px">—</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-2xs text-ink-faint">
        This quote holds until{" "}
        <span className="num">
          {new Date(output.expiresAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </span>
        . Costs move with the season and with competition, so re-run it rather than
        reusing an old one. The committed CPL on the order is a separate decision —
        it is not filled in from this number.
      </p>
    </div>
  )
}

/**
 * Ranges are rendered as a span between two values, never as a single figure
 * with a ± next to it. The visual should make it impossible to read a point
 * estimate out of a projection that does not have one.
 */
function Band({
  label, low, high, caption,
}: {
  label: string
  low: string
  high: string
  caption: string
}) {
  return (
    <div className="px-5 py-5">
      <div className="eyebrow">{label}</div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className="num text-3xl font-semibold tracking-tight">{low}</span>
        <span className="text-ink-faint text-lg">to</span>
        <span className="num text-3xl font-semibold tracking-tight">{high}</span>
      </div>
      <div className="mt-3 h-1.5 bg-ground border border-rule relative overflow-hidden">
        <div className="absolute inset-y-0 left-[12%] right-[12%] bg-accent" />
      </div>
      <div className="text-2xs text-ink-faint mt-2">{caption}</div>
    </div>
  )
}
