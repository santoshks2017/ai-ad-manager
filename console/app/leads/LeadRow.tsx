"use client"

import { useState } from "react"
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/types"

/**
 * Phone numbers are masked until asked for.
 *
 * An account manager scanning the inbox does not need to read every customer's
 * number, and a screen-shared or over-the-shoulder inbox should not expose the
 * whole list. One click reveals the one that is needed.
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "•••• ••••"
  return `•••• •••${digits.slice(-3)}`
}

export function LeadRow({
  lead,
  campaignName,
  dealerName,
}: {
  lead: Lead
  campaignName: string | null
  dealerName: string
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [notes, setNotes] = useState(lead.notes ?? "")
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(patch: { status?: LeadStatus; notes?: string }) {
    setSaving(true)
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    } finally {
      setSaving(false)
    }
  }

  const tone: Record<LeadStatus, string> = {
    new: "bg-accent-soft text-accent border-accent/25",
    contacted: "bg-amber-soft text-amber border-amber/25",
    qualified: "bg-signal-soft text-signal border-signal/20",
    lost: "bg-ground text-ink-faint border-rule",
  }

  return (
    <>
      <tr className="sheet-row hover:bg-ground align-top">
        <td className="px-3 py-2.5">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-left hover:underline font-medium"
            aria-expanded={open}
          >
            {lead.name}
          </button>
          <div className="text-2xs text-ink-faint mt-0.5">{dealerName}</div>
        </td>
        <td className="px-3 py-2.5">
          <button
            onClick={() => setRevealed(true)}
            className="num text-sm hover:underline"
            title={revealed ? undefined : "Click to reveal"}
          >
            {revealed ? lead.phone : maskPhone(lead.phone)}
          </button>
        </td>
        <td className="px-3 py-2.5 text-ink-soft">{lead.model ?? "—"}</td>
        <td className="px-3 py-2.5 capitalize text-ink-soft">{lead.platform}</td>
        <td className="px-3 py-2.5">
          <span className="text-2xs text-ink-soft">
            {lead.source === "call" ? "Call" : lead.source === "landing_page" ? "Landing page" : "Platform form"}
          </span>
        </td>
        <td className="px-3 py-2.5 num text-2xs text-ink-soft whitespace-nowrap">
          {new Date(lead.receivedAt).toLocaleDateString("en-IN", {
            day: "numeric", month: "short",
          })}
        </td>
        <td className="px-3 py-2.5">
          <select
            value={status}
            disabled={saving}
            onChange={(e) => {
              const next = e.target.value as LeadStatus
              setStatus(next)
              save({ status: next })
            }}
            aria-label={`Status for ${lead.name}`}
            className={`text-2xs uppercase tracking-[0.08em] font-medium border px-1.5 py-1
                        outline-none focus:border-accent ${tone[status]}`}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </td>
      </tr>
      {open && (
        <tr className="bg-ground">
          <td colSpan={7} className="px-3 py-3">
            <div className="grid sm:grid-cols-[1fr_260px] gap-4">
              <div>
                <label className="label" htmlFor={`notes-${lead.id}`}>
                  Follow-up notes
                </label>
                <textarea
                  id={`notes-${lead.id}`}
                  className="field h-auto py-2"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => save({ notes })}
                  placeholder="What happened on the call?"
                />
              </div>
              <dl className="text-sm space-y-1.5">
                <Row label="Email" value={lead.email ?? "Not provided"} />
                <Row label="City" value={lead.city ?? "—"} />
                <Row label="Campaign" value={campaignName ?? "—"} />
                <Row
                  label="In LMS"
                  value={lead.lmsRef ?? "Not synced yet"}
                />
              </dl>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft shrink-0">{label}</dt>
      <dd className="num text-right truncate">{value}</dd>
    </div>
  )
}
