"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { inr } from "@/lib/format"
import { CAMPAIGN_TYPES, OBJECTIVES } from "@/lib/types"
import { campaignReadiness } from "@/lib/campaign-readiness"
import type { CampaignType, Dealer, ImageAsset, Objective, Platform } from "@/lib/types"

export function NewCampaignForm({
  dealers,
  images,
}: {
  dealers: Dealer[]
  images: ImageAsset[]
}) {
  const router = useRouter()
  const eligible = dealers.filter((d) => d.status === "active")

  const [dealerId, setDealerId] = useState(eligible[0]?.id ?? "")
  const [model, setModel] = useState(eligible[0]?.models[0] ?? "")
  const [objective, setObjective] = useState<Objective>("leads")
  const [campaignType, setCampaignType] = useState<CampaignType>("search")
  const [platforms, setPlatforms] = useState<Platform[]>(["google", "meta"])
  const [monthlyBudget, setMonthlyBudget] = useState(100_000)
  const [metaSharePct, setMetaSharePct] = useState(65)
  const [radiusKm, setRadiusKm] = useState(25)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [headline, setHeadline] = useState("")
  const [offer, setOffer] = useState("")
  const [goLive, setGoLive] = useState(true)
  const [description, setDescription] = useState("")

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number
    failures: { platform: string; error: string }[]
    builds: { platform: string; keywordCount: number; negativeKeywordCount: number; adCount: number; status: string; warnings: string[] }[]
  } | null>(null)

  const dealer = eligible.find((d) => d.id === dealerId)

  // Whether the chosen Google campaign type can actually serve. Performance Max
  // and Demand Gen accept a campaign with no imagery and then never deliver.
  const readiness = useMemo(
    () => (dealer ? campaignReadiness(campaignType, dealer, images) : null),
    [dealer, campaignType, images],
  )

  const blockers = useMemo(() => {
    if (!dealer) return []
    const b: string[] = []
    if (!dealer.platform?.servicesAgreementSigned) b.push("Services agreement unsigned")
    if (platforms.includes("google") && dealer.platform?.googleState !== "ready")
      b.push("Google Ads account not ready")
    if (platforms.includes("meta") && dealer.platform?.metaState !== "ready")
      b.push("Meta Page and ad account not ready")
    if (platforms.includes("google") && readiness && !readiness.ready) {
      for (const p of readiness.problems.filter((x) => x.blocking)) b.push(p.message)
    }
    return b
  }, [dealer, platforms, readiness])

  const autoHeadline = dealer ? `${model} at ${dealer.name}` : ""
  const autoDescription = dealer
    ? `Book a test drive in ${dealer.city}. Best offers on the ${model}. Talk to us today.`
    : ""

  function togglePlatform(p: Platform) {
    setPlatforms((cur) =>
      cur.includes(p) ? (cur.length === 1 ? cur : cur.filter((x) => x !== p)) : [...cur, p],
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealerId, model, objective, platforms, monthlyBudget, metaSharePct,
          radiusKm, startDate, endDate: null,
          headline: headline || autoHeadline,
          description: description || autoDescription,
          offer: offer || null,
          goLive,
          campaignType,
        }),
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) {
        setError(data.error ?? "Could not create the campaign.")
      } else {
        setResult({
          created: data.created?.length ?? 0,
          failures: data.failures ?? [],
          builds: data.builds ?? [],
        })
        router.refresh()
      }
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setBusy(false)
    }
  }

  if (eligible.length === 0) {
    return (
      <div className="sheet p-10 text-center">
        <div className="font-display font-bold text-lg">No active dealers</div>
        <p className="text-sm text-ink-soft mt-2">
          Activate a dealer before creating campaigns.
        </p>
      </div>
    )
  }

  const metaBudget = platforms.includes("meta")
    ? platforms.length === 1 ? monthlyBudget : monthlyBudget * (metaSharePct / 100)
    : 0
  const googleBudget = platforms.includes("google")
    ? platforms.length === 1 ? monthlyBudget : monthlyBudget * (1 - metaSharePct / 100)
    : 0

  return (
    <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-6 items-start">
      <form onSubmit={submit} className="card p-5 space-y-4 min-w-0">
        <div>
          <label className="label" htmlFor="dealer">Dealer</label>
          <select
            id="dealer" className="field" value={dealerId}
            onChange={(e) => {
              setDealerId(e.target.value)
              const d = eligible.find((x) => x.id === e.target.value)
              if (d) setModel(d.models[0] ?? "")
            }}
          >
            {eligible.map((d) => (
              <option key={d.id} value={d.id}>{d.name} · {d.city}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="model">Model</label>
          <input
            id="model" className="field" list="models" value={model}
            onChange={(e) => setModel(e.target.value)} required
          />
          <datalist id="models">
            {dealer?.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>

        <div>
          <span className="label">Google campaign type</span>
          <div className="space-y-2">
            {Object.values(CAMPAIGN_TYPES).map((t) => (
              <label
                key={t.id}
                className={`block p-3 border cursor-pointer transition-colors ${
                  campaignType === t.id
                    ? "border-accent bg-accent-soft"
                    : "border-rule hover:bg-ground"
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <input
                    type="radio" checked={campaignType === t.id}
                    onChange={() => setCampaignType(t.id)}
                    className="mt-0.5 accent-[#008075]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{t.label}</span>
                      {t.supportsLeadForm && (
                        <span className="text-2xs uppercase tracking-[0.08em] px-1.5 py-0.5
                                         border border-signal/20 bg-signal-soft text-signal">
                          Lead form
                        </span>
                      )}
                      {t.requiresImages && (
                        <span className="text-2xs uppercase tracking-[0.08em] px-1.5 py-0.5
                                         border border-amber/25 bg-amber-soft text-amber">
                          Needs images
                        </span>
                      )}
                    </span>
                    <span className="block text-2xs text-ink-soft mt-0.5">
                      {t.description}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {readiness && readiness.problems.length > 0 && (
          <div className="space-y-2">
            {readiness.problems.map((p, i) => (
              <div
                key={i}
                className={`px-3 py-2.5 border text-sm ${
                  p.blocking
                    ? "bg-alert-soft border-alert/25"
                    : "bg-amber-soft border-amber/25"
                }`}
              >
                <span className="font-medium">
                  {p.blocking ? "Cannot run yet." : "Worth fixing."}
                </span>{" "}
                <span className="text-ink-soft">{p.message}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="label" htmlFor="objective">Objective</label>
          <select
            id="objective" className="field" value={objective}
            onChange={(e) => setObjective(e.target.value as Objective)}
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <span className="label">Platforms</span>
          <div className="flex gap-2">
            {(["google", "meta"] as Platform[]).map((p) => (
              <button
                key={p} type="button" onClick={() => togglePlatform(p)}
                aria-pressed={platforms.includes(p)}
                className={`flex-1 h-10 border text-sm capitalize transition-colors ${
                  platforms.includes(p)
                    ? "border-accent bg-accent-soft text-accent font-medium"
                    : "border-rule-strong bg-surface text-ink-soft hover:bg-ground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="budget">Monthly budget</label>
          <input
            id="budget" type="number" min={5000} step={5000} className="field num"
            value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))}
          />
        </div>

        {platforms.length === 2 && (
          <div>
            <label className="label" htmlFor="split">
              Split — Meta {metaSharePct}% / Google {100 - metaSharePct}%
            </label>
            <input
              id="split" type="range" min={10} max={90} step={5} className="w-full"
              value={metaSharePct} onChange={(e) => setMetaSharePct(Number(e.target.value))}
            />
            <div className="flex justify-between text-2xs text-ink-faint num mt-1">
              <span>Meta {inr(metaBudget)}</span>
              <span>Google {inr(googleBudget)}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="radius">Radius (km)</label>
            <input
              id="radius" type="number" min={1} max={200} className="field num"
              value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="start">Start</label>
            <input
              id="start" type="date" className="field num"
              value={startDate} onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="offer">Offer (optional)</label>
          <input
            id="offer" className="field" maxLength={120} value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="Exchange bonus up to ₹40,000"
          />
        </div>

        <div>
          <label className="label" htmlFor="headline">Headline</label>
          <input
            id="headline" className="field" maxLength={120}
            placeholder={autoHeadline} value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="desc">Description</label>
          <textarea
            id="desc" className="field h-auto py-2" rows={3} maxLength={300}
            placeholder={autoDescription} value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {blockers.length > 0 && (
          <div className="px-3 py-2.5 bg-amber-soft border border-amber/25 text-sm">
            <span className="font-medium text-amber">Not ready to create.</span>{" "}
            <span className="text-ink-soft">{blockers.join(". ")}.</span>
          </div>
        )}

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox" checked={goLive}
            onChange={(e) => setGoLive(e.target.checked)}
            className="mt-0.5 accent-[#008075]"
          />
          <span className="text-sm">
            <span className="font-medium">Go live immediately</span>
            <span className="block text-2xs text-ink-faent text-ink-faint mt-0.5">
              Starts serving as soon as it is built. Leave unticked to create it paused
              and review the targeting first.
            </span>
          </span>
        </label>

        <button
          type="submit" className="btn-primary w-full"
          disabled={busy || blockers.length > 0}
        >
          {busy ? "Building…" : goLive ? "Build and go live" : "Build, leave paused"}
        </button>
        <p className="text-2xs text-ink-faint">
          Keywords, negative keywords and ads are generated and pushed with the campaign.
          {goLive
            ? " This will start spending money as soon as the platforms approve it."
            : " Nothing spends until someone starts it."}
        </p>
      </form>

      <div className="space-y-5 min-w-0">
        {error && (
          <div className="px-4 py-3 bg-alert-soft border border-alert/25 text-sm text-alert">
            {error}
          </div>
        )}

        {result && (
          <div
            className={`px-4 py-3 border text-sm ${
              result.failures.length > 0
                ? "bg-amber-soft border-amber/25"
                : "bg-signal-soft border-signal/20"
            }`}
          >
            <div className="font-medium">
              {result.created} campaign{result.created === 1 ? "" : "s"} built
              {result.builds.some((b) => b.status === "active") ? " and live" : ", paused"}.
            </div>
            {result.builds.map((b) => (
              <div key={b.platform} className="text-ink-soft mt-1 num text-2xs">
                <span className="capitalize font-medium">{b.platform}</span>:{" "}
                {b.adCount} ad{b.adCount === 1 ? "" : "s"}
                {b.keywordCount > 0 && `, ${b.keywordCount} keywords`}
                {b.negativeKeywordCount > 0 && `, ${b.negativeKeywordCount} negatives`}
              </div>
            ))}
            {result.builds.flatMap((b) => b.warnings).map((w, i) => (
              <div key={i} className="text-amber mt-1 text-2xs">{w}</div>
            ))}
            {result.failures.map((f) => (
              <div key={f.platform} className="text-ink-soft mt-1">
                <span className="capitalize font-medium">{f.platform}</span> failed: {f.error}
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="eyebrow mb-2">How it will look</div>
          <div className="space-y-4">
            {platforms.includes("google") && (
              <GooglePreview
                headline={headline || autoHeadline}
                description={description || autoDescription}
                url={dealer?.landingPageUrl ?? ""}
              />
            )}
            {platforms.includes("meta") && (
              <MetaPreview
                dealerName={dealer?.name ?? ""}
                headline={headline || autoHeadline}
                description={description || autoDescription}
                phone={dealer?.virtualNumber ?? null}
              />
            )}
          </div>
        </div>

        {dealer && (
          <div className="card p-4">
            <div className="eyebrow mb-2">Where leads will go</div>
            <dl className="text-sm space-y-1.5">
              <Row label="Landing page" value={dealer.landingPageUrl ?? "Not set up"} />
              <Row label="Virtual number" value={dealer.virtualNumber ?? "Not assigned"} />
              <Row label="LMS account" value={dealer.lmsAccountRef ?? "Not provisioned"} />
            </dl>
            <p className="text-2xs text-ink-faint mt-2.5">
              Leads flow from the landing page and the number straight into the dealer's
              LMS. This console does not touch them.
            </p>
          </div>
        )}
      </div>
    </div>
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

function GooglePreview({
  headline, description, url,
}: {
  headline: string
  description: string
  url: string
}) {
  const display = url ? url.replace(/^https?:\/\//, "").split("/")[0] : "your-landing-page.in"
  return (
    <div className="sheet p-4">
      <div className="eyebrow mb-3">Google Search</div>
      <div className="max-w-xl">
        <div className="flex items-center gap-1.5 text-2xs">
          <span className="font-semibold border border-ink px-1">Ad</span>
          <span className="text-ink-soft num">{display}</span>
        </div>
        <div className="text-[#1a0dab] text-lg leading-snug mt-1">
          {headline || "Your headline appears here"}
        </div>
        <div className="text-sm text-ink-soft mt-0.5">
          {description || "Your description appears here."}
        </div>
      </div>
    </div>
  )
}

function MetaPreview({
  dealerName, headline, description, phone,
}: {
  dealerName: string
  headline: string
  description: string
  phone: string | null
}) {
  return (
    <div className="sheet p-4">
      <div className="eyebrow mb-3">Meta feed</div>
      <div className="max-w-sm border border-rule">
        <div className="flex items-center gap-2 p-3">
          <div className="w-8 h-8 rounded-full bg-accent-soft border border-rule shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {dealerName || "Dealer Page"}
            </div>
            <div className="text-2xs text-ink-faint">Sponsored</div>
          </div>
        </div>
        <div className="px-3 pb-2 text-sm">{description || "Your ad copy appears here."}</div>
        <div className="aspect-[1.91/1] bg-ground border-y border-rule flex items-center justify-center">
          <span className="text-2xs text-ink-faint">Creative</span>
        </div>
        <div className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {headline || "Your headline"}
            </div>
            {phone && <div className="text-2xs text-ink-faint num">{phone}</div>}
          </div>
          <span className="text-2xs border border-rule-strong px-2 py-1 shrink-0">
            Learn more
          </span>
        </div>
      </div>
      <p className="text-2xs text-ink-faint mt-3">
        The Page name shown is the dealer's own Page. Meta requires ads to represent the
        business being advertised, so these cannot run from a CarDekho Page.
      </p>
    </div>
  )
}
