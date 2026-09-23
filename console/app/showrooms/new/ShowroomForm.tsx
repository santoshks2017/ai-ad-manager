"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

const BRANDS = [
  "Maruti Suzuki", "Hyundai", "Tata", "Mahindra", "Kia", "Toyota", "Honda",
  "MG", "Skoda", "Volkswagen", "Renault", "Nissan", "Citroen", "Jeep",
  "BMW", "Mercedes-Benz", "Audi", "Volvo",
]

const STATES = [
  "Uttar Pradesh", "Maharashtra", "Karnataka", "Tamil Nadu", "Delhi",
  "Gujarat", "Rajasthan", "Telangana", "West Bengal", "Madhya Pradesh",
  "Kerala", "Punjab", "Haryana", "Bihar", "Odisha", "Andhra Pradesh",
  "Assam", "Jharkhand", "Chhattisgarh", "Uttarakhand",
]

/** Suggest a code from the name and city, since it has to be unique and typed. */
function suggestCode(name: string, city: string): string {
  const n = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3)
  const c = city.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3)
  return (n + c).slice(0, 6)
}

export function ShowroomForm() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("Uttar Pradesh")
  const [code, setCode] = useState("")
  const [codeTouched, setCodeTouched] = useState(false)
  const [brands, setBrands] = useState<string[]>([])
  const [models, setModels] = useState("")
  const [monthlyBudget, setMonthlyBudget] = useState(100_000)
  const [committedCpl, setCommittedCpl] = useState("")
  const [virtualNumber, setVirtualNumber] = useState("")
  const [landingPageUrl, setLandingPageUrl] = useState("")
  const [lmsAccountRef, setLmsAccountRef] = useState("")
  const [ownership, setOwnership] = useState<"dealer_linked" | "agency_owned">("dealer_linked")
  const [billing, setBilling] = useState<"agency_billed" | "dealer_billed">("agency_billed")

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const derivedCode = codeTouched ? code : suggestCode(name, city)

  function toggleBrand(b: string) {
    setBrands((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: derivedCode.toUpperCase(),
          name, city, state, brands,
          models: models.split(",").map((m) => m.trim()).filter(Boolean),
          monthlyBudget,
          committedCpl: committedCpl ? Number(committedCpl) : null,
          virtualNumber: virtualNumber || null,
          landingPageUrl: landingPageUrl || null,
          lmsAccountRef: lmsAccountRef || null,
          ownership, billing,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not add the showroom.")
        return
      }
      router.push(`/dealers/${data.dealer.id}`)
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        <section className="card p-5 space-y-4">
          <div className="eyebrow">The dealership</div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="name">Showroom name</label>
              <input
                id="name" className="field" required maxLength={120}
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Apex Hyundai"
              />
            </div>
            <div>
              <label className="label" htmlFor="code">Code</label>
              <input
                id="code" className="field num uppercase" required maxLength={12}
                value={derivedCode}
                onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase()) }}
              />
              <p className="text-2xs text-ink-faint mt-1">
                Appears in every platform campaign name, so it has to be unique.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="city">City</label>
              <input
                id="city" className="field" required maxLength={60}
                value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Lucknow"
              />
            </div>
            <div>
              <label className="label" htmlFor="state">State</label>
              <select id="state" className="field" value={state}
                      onChange={(e) => setState(e.target.value)}>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="label">Brands</span>
            <div className="flex flex-wrap gap-1.5">
              {BRANDS.map((b) => (
                <button
                  key={b} type="button" onClick={() => toggleBrand(b)}
                  aria-pressed={brands.includes(b)}
                  className={`px-2.5 py-1 text-sm border transition-colors ${
                    brands.includes(b)
                      ? "border-accent bg-accent-soft text-accent font-medium"
                      : "border-rule bg-surface text-ink-soft hover:bg-ground"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="models">Models to advertise</label>
            <input
              id="models" className="field" required
              value={models} onChange={(e) => setModels(e.target.value)}
              placeholder="Creta, Venue, Exter"
            />
            <p className="text-2xs text-ink-faint mt-1">Comma separated.</p>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <div className="eyebrow">Commercials</div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="budget">Monthly budget (₹)</label>
              <input
                id="budget" type="number" min={0} step={5000} className="field num"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label" htmlFor="cpl">Committed CPL (₹)</label>
              <input
                id="cpl" type="number" min={0} className="field num"
                value={committedCpl} onChange={(e) => setCommittedCpl(e.target.value)}
                placeholder="Leave blank if not committed"
              />
              <p className="text-2xs text-ink-faint mt-1">
                Only fill this in once it has actually been agreed. It is never taken
                from a quote.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <div className="eyebrow">Lead delivery</div>
          <p className="text-2xs text-ink-faint -mt-2">
            Provisioned outside this console. Recorded here so campaigns point at the
            right places.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="vn">Virtual number</label>
              <input
                id="vn" className="field num" value={virtualNumber}
                onChange={(e) => setVirtualNumber(e.target.value)}
                placeholder="+91 80000 00000"
              />
            </div>
            <div>
              <label className="label" htmlFor="lms">LMS account reference</label>
              <input
                id="lms" className="field num" value={lmsAccountRef}
                onChange={(e) => setLmsAccountRef(e.target.value)}
                placeholder="LMS-APXHYD-001"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="lp">Landing page URL</label>
            <input
              id="lp" className="field" value={landingPageUrl}
              onChange={(e) => setLandingPageUrl(e.target.value)}
              placeholder="https://lp.cardekho-ads.in/apex-hyundai-lucknow"
            />
          </div>
        </section>
      </div>

      <aside className="space-y-6 min-w-0">
        <section className="card p-5 space-y-4">
          <div className="eyebrow">Account model</div>

          <div>
            <span className="label">Who owns the ad accounts</span>
            <div className="space-y-2">
              <Choice
                checked={ownership === "dealer_linked"}
                onChange={() => setOwnership("dealer_linked")}
                title="The showroom owns them"
                detail="They grant us access. They keep their history if they leave, and our exposure is the unpaid fee rather than the ad spend."
              />
              <Choice
                checked={ownership === "agency_owned"}
                onChange={() => setOwnership("agency_owned")}
                title="We own them"
                detail="Nothing for the showroom to do. On Meta this is permanent — ad accounts never transfer between business portfolios."
              />
            </div>
          </div>

          <div>
            <span className="label">Who pays the platforms</span>
            <div className="space-y-2">
              <Choice
                checked={billing === "agency_billed"}
                onChange={() => setBilling("agency_billed")}
                title="We pay, then invoice"
                detail="We carry the spend until they settle."
              />
              <Choice
                checked={billing === "dealer_billed"}
                onChange={() => setBilling("dealer_billed")}
                title="Their card is charged"
                detail="No working capital and no credit risk for us."
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="px-4 py-3 bg-alert-soft border border-alert/25 text-sm text-alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Adding…" : "Add showroom"}
        </button>
        <p className="text-2xs text-ink-faint">
          Added as awaiting account link. Nothing can run until the services agreement
          is signed and the platform accounts are connected.
        </p>
      </aside>
    </form>
  )
}

function Choice({
  checked, onChange, title, detail,
}: {
  checked: boolean
  onChange: () => void
  title: string
  detail: string
}) {
  return (
    <label
      className={`block p-3 border cursor-pointer transition-colors ${
        checked ? "border-accent bg-accent-soft" : "border-rule hover:bg-ground"
      }`}
    >
      <span className="flex items-start gap-2.5">
        <input
          type="radio" checked={checked} onChange={onChange}
          className="mt-0.5 accent-[#008075]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-2xs text-ink-soft mt-0.5">{detail}</span>
        </span>
      </span>
    </label>
  )
}
