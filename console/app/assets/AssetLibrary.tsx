"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { ROLE_SPECS, type ImageRole } from "@/lib/image"
import type { Dealer, ImageAsset } from "@/lib/types"

const ROLES: ImageRole[] = ["landscape", "square", "logo", "portrait"]

export function AssetLibrary({
  dealers,
  images,
  selectedDealerId,
}: {
  dealers: Dealer[]
  images: ImageAsset[]
  selectedDealerId: string
}) {
  const router = useRouter()
  const [dealerId, setDealerId] = useState(selectedDealerId)
  const [busyRole, setBusyRole] = useState<ImageRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const mine = images.filter((i) => i.dealerId === dealerId)

  async function upload(role: ImageRole, file: File) {
    setBusyRole(role)
    setError(null)
    try {
      const body = new FormData()
      body.set("dealerId", dealerId)
      body.set("role", role)
      body.set("file", file)

      const res = await fetch("/api/assets", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Upload failed.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setBusyRole(null)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/assets/${id}`, { method: "DELETE" })
    router.refresh()
  }

  function changeDealer(next: string) {
    setDealerId(next)
    router.push(`/assets?dealer=${next}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="dealer">Showroom</label>
          <select
            id="dealer" className="field w-64" value={dealerId}
            onChange={(e) => changeDealer(e.target.value)}
          >
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>{d.name} · {d.city}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-alert-soft border border-alert/25 text-sm text-alert">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        {ROLES.map((role) => {
          const spec = ROLE_SPECS[role]
          const assets = mine.filter((i) => i.role === role)
          const required = role !== "portrait"

          return (
            <section key={role} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{spec.label}</span>
                    <span className="num text-2xs text-ink-faint">{spec.ratioLabel}</span>
                    {required && assets.length === 0 && (
                      <span className="text-2xs uppercase tracking-[0.08em] px-1.5 py-0.5
                                       border border-alert/25 bg-alert-soft text-alert">
                        Missing
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-ink-faint mt-1">
                    At least {spec.minWidth} × {spec.minHeight}, {spec.recommended} is
                    better. Used by {spec.usedBy}.
                  </p>
                </div>
                <span className="num text-sm text-ink-soft shrink-0">{assets.length}</span>
              </div>

              {assets.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {assets.map((a) => (
                    <figure key={a.id} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt=""
                        className="h-20 w-auto max-w-[160px] object-cover border border-rule bg-ground"
                      />
                      <figcaption className="num text-2xs text-ink-faint mt-1">
                        {a.widthPx} × {a.heightPx}
                      </figcaption>
                      <button
                        onClick={() => remove(a.id)}
                        aria-label="Remove asset"
                        className="absolute top-1 right-1 bg-surface border border-rule
                                   text-2xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100
                                   focus:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    </figure>
                  ))}
                </div>
              )}

              <input
                ref={(el) => { inputs.current[role] = el }}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) upload(role, f)
                  e.target.value = ""
                }}
              />
              <button
                className="btn-quiet mt-4 w-full"
                disabled={busyRole === role}
                onClick={() => inputs.current[role]?.click()}
              >
                {busyRole === role ? "Checking and uploading…" : `Upload ${spec.label.toLowerCase()}`}
              </button>
            </section>
          )
        })}
      </div>

      <AiGeneration />
    </div>
  )
}

/**
 * Placeholder for generated creative.
 *
 * Shown disabled rather than hidden so the shape of the feature is visible and
 * the work it replaces is obvious — but it makes no claim to work, because it
 * does not.
 */
function AiGeneration() {
  return (
    <section className="card p-5 border-dashed">
      <div className="flex items-center gap-2.5">
        <span className="font-medium text-sm">Generate creative</span>
        <span className="text-2xs uppercase tracking-[0.08em] px-1.5 py-0.5
                         border border-rule bg-ground text-ink-faint">
          Not built yet
        </span>
      </div>
      <p className="text-sm text-ink-soft mt-2 max-w-2xl">
        Produce the full set from a model name and a photo of the forecourt —
        correctly cropped for each placement, so nobody has to open an image editor
        to get a 1.91:1 landscape out of a portrait phone picture.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-4 max-w-2xl opacity-50 pointer-events-none">
        <div>
          <label className="label" htmlFor="gen-prompt">What to show</label>
          <input
            id="gen-prompt" className="field" disabled
            placeholder="Hyundai Creta, front three-quarter, showroom forecourt"
          />
        </div>
        <div>
          <label className="label" htmlFor="gen-source">Start from</label>
          <select id="gen-source" className="field" disabled>
            <option>An uploaded photo</option>
            <option>The manufacturer&rsquo;s press image</option>
            <option>Text description only</option>
          </select>
        </div>
      </div>

      <button className="btn-quiet mt-4" disabled>
        Generate all four sizes
      </button>
      <p className="text-2xs text-ink-faint mt-3">
        Whatever this generates will land in the same library and pass the same
        validation as an upload. Nothing reaches a campaign without the aspect
        ratio and size being correct.
      </p>
    </section>
  )
}
