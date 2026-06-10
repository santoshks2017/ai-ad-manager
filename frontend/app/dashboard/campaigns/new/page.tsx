"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "../../../../lib/api"
import Link from "next/link"

interface Template {
  id: string
  name: string
  icon: string
  headline: string
  description: string
  cta: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState<number>(1)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  
  // Form fields
  const [name, setName] = useState("")
  const [carModel, setCarModel] = useState("Maruti Swift")
  const [offerText, setOfferText] = useState("")
  const [budget, setBudget] = useState(25000)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [targetLocation, setTargetLocation] = useState("Pune, Maharashtra")
  const [platforms, setPlatforms] = useState<string[]>(["google", "meta"])
  
  // Loading & statuses
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await api.campaigns.templates()
        setTemplates(data)
      } catch (err) {
        console.error("Failed to load templates:", err)
      }
    }
    fetchTemplates()
    
    const today = new Date()
    const future = new Date()
    future.setDate(today.getDate() + 14)
    
    setStartDate(today.toISOString().split("T")[0])
    setEndDate(future.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      const replacedHeadline = selectedTemplate.headline.replace("{model}", carModel)
      setOfferText(replacedHeadline)
      setName(`${selectedTemplate.name} - ${carModel}`)
    }
  }, [selectedTemplate, carModel])

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template)
    setStep(2)
  }

  const handleTogglePlatform = (platform: string) => {
    if (platforms.includes(platform)) {
      if (platforms.length > 1) {
        setPlatforms(platforms.filter(p => p !== platform))
      }
    } else {
      setPlatforms([...platforms, platform])
    }
  }

  const handlePublish = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        name,
        templateType: selectedTemplate?.id,
        carModel,
        offerText,
        budget,
        startDate,
        endDate,
        targetLocation,
        platforms
      }
      
      const res = await api.campaigns.create(payload)
      if (res.success) {
        setSuccess(true)
        setStep(4)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to publish campaign. Verify ad accounts are connected.")
    } finally {
      setLoading(false)
    }
  }

  const renderStepsIndicator = () => {
    if (step === 4) return null
    return (
      <div className="flex items-center justify-center gap-4 mb-6 bg-white py-4 px-6 rounded-2xl border border-slate-200/70 shadow-xs">
        {[
          { num: 1, label: "Select Template" },
          { num: 2, label: "Configure Details" },
          { num: 3, label: "Ad Preview & Launch" }
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition ${
                step === s.num
                  ? "bg-[#008075] text-white"
                  : step > s.num
                  ? "bg-[#eaf5f5] text-[#008075]"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              className={`text-xs font-semibold ${
                step === s.num ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
            {s.num < 3 && <div className="h-0.5 w-6 bg-slate-200" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title & back button header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {step === 4 ? "Campaign Launched!" : "Campaign Launcher"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish ads on Google Ads and Meta Ads simultaneously using pre-filled dealer templates.
          </p>
        </div>
        {step > 1 && step < 4 && (
          <button
            onClick={() => setStep(step - 1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            ← Back
          </button>
        )}
      </div>

      {renderStepsIndicator()}

      {/* Step 1: Select Template */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">Select ad template</h2>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {templates.map((temp) => (
              <div
                key={temp.id}
                onClick={() => handleSelectTemplate(temp)}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-[#008075] hover:shadow-sm"
              >
                <div className="text-2xl mb-3 bg-[#eaf5f5] h-10 w-10 rounded-xl flex items-center justify-center text-[#008075] group-hover:bg-[#008075] group-hover:text-white transition-colors duration-200">
                  {temp.icon}
                </div>
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-[#008075]">
                  {temp.name}
                </h3>
                <p className="mt-2 text-[11px] text-slate-600 line-clamp-3 leading-relaxed">
                  {temp.description.replace("{model}", "Swift/Brezza")}
                </p>
                <div className="mt-4 flex items-center justify-end text-[10px] font-bold text-[#008075] opacity-0 group-hover:opacity-100 transition duration-150">
                  Configure →
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Configure Details Form */}
      {step === 2 && selectedTemplate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <span className="text-xl bg-slate-50 p-2 rounded-xl">{selectedTemplate.icon}</span>
            <div>
              <h2 className="text-base font-bold text-slate-850">Configure {selectedTemplate.name}</h2>
              <p className="text-xs text-slate-400">Fill in the fields below to automatically generate copywriting.</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Car Model</label>
              <select
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              >
                <option value="Maruti Swift">Maruti Suzuki Swift</option>
                <option value="Maruti Brezza">Maruti Suzuki Brezza</option>
                <option value="Hyundai Creta">Hyundai Creta</option>
                <option value="Maruti Baleno">Maruti Suzuki Baleno</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Offer Headline (Editable)</label>
              <input
                type="text"
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly Budget (₹)</label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Location radius</label>
              <input
                type="text"
                value={targetLocation}
                onChange={(e) => setTargetLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-850 focus:border-[#008075] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Target Platforms</label>
              <div className="mt-2 flex gap-4">
                <button
                  type="button"
                  onClick={() => handleTogglePlatform("google")}
                  className={`flex-1 rounded-xl border p-3.5 text-xs font-semibold transition flex items-center justify-between ${
                    platforms.includes("google")
                      ? "border-[#008075] bg-[#eaf5f5] text-[#008075]"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span>🔍 Google Ads</span>
                  <span>{platforms.includes("google") ? "✓" : ""}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePlatform("meta")}
                  className={`flex-1 rounded-xl border p-3.5 text-xs font-semibold transition flex items-center justify-between ${
                    platforms.includes("meta")
                      ? "border-[#008075] bg-[#eaf5f5] text-[#008075]"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <span>📱 Meta Ads</span>
                  <span>{platforms.includes("meta") ? "✓" : ""}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setStep(3)}
              className="rounded-xl bg-[#ff6f00] hover:bg-[#e65c00] px-6 py-3 text-xs font-bold text-white transition shadow-sm"
            >
              Continue to Preview →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Ad Previews */}
      {step === 3 && selectedTemplate && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Google */}
            {platforms.includes("google") && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Google Search Ad Preview</h3>
                <div className="border border-slate-150 rounded-xl p-4 bg-white font-sans text-xs">
                  <div className="text-[10px] text-slate-650 flex items-center gap-1">
                    <span>pune-maruti.com</span>
                    <span className="text-[9px] bg-slate-100 px-1 rounded font-bold text-slate-500">Sponsored</span>
                  </div>
                  <div className="text-base font-semibold text-[#1a0dab] hover:underline cursor-pointer mt-1 leading-snug">
                    {offerText}
                  </div>
                  <p className="text-xs text-[#4d5156] mt-2 leading-relaxed">
                    {selectedTemplate.description.replace("{model}", carModel)}
                  </p>
                </div>
              </div>
            )}

            {/* Meta */}
            {platforms.includes("meta") && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meta Feed Ad Preview</h3>
                <div className="border border-slate-150 rounded-xl bg-white overflow-hidden text-xs">
                  <div className="p-3.5 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[#008075] flex items-center justify-center text-white text-[10px] font-bold">
                      CD
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">Pune Maruti Suzuki</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">Sponsored</p>
                    </div>
                  </div>
                  <p className="px-3.5 pb-2.5 text-xs text-slate-800 leading-relaxed">
                    {selectedTemplate.description.replace("{model}", carModel)}
                  </p>
                  <div className="h-40 bg-slate-100 flex flex-col items-center justify-center border-y border-slate-150">
                    <span className="text-2xl">🚗</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{carModel} Photo</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 flex items-center justify-between">
                    <div className="overflow-hidden pr-2">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">PUNE-MARUTI.COM</p>
                      <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{offerText}</p>
                    </div>
                    <button className="bg-slate-200 hover:bg-slate-350 text-slate-800 text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider shrink-0">
                      {selectedTemplate.cta}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Launch Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <h2 className="text-sm font-bold text-slate-800">Launch Configuration</h2>
            
            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Impressions Estimate</span>
                <p className="text-base font-bold text-slate-900 mt-1">
                  ~{(budget * 12).toLocaleString("en-IN")} impressions
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Budget</span>
                <p className="text-base font-bold text-slate-900 mt-1">
                  ₹{budget.toLocaleString("en-IN")}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</span>
                <p className="text-xs font-bold text-slate-900 mt-1">
                  {new Date(startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - {new Date(endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 font-semibold">
                ⚠️ {error}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[10px] text-slate-400">By clicking "Publish Campaign", ads will deploy instantly to active platforms.</span>
              <button
                onClick={handlePublish}
                disabled={loading}
                className="rounded-xl bg-[#ff6f00] hover:bg-[#e65c00] px-8 py-3 text-sm font-bold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Publishing...
                  </>
                ) : (
                  "Publish Campaign 🚀"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Success confirmation screen */}
      {step === 4 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center space-y-6 max-w-md mx-auto">
          <div className="h-12 w-12 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xl rounded-full flex items-center justify-center mx-auto">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-850">Campaign Launched Successfully!</h2>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              Your campaign settings have been synced. Google Ads and Meta Ads campaigns will propagate metrics shortly.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 text-left text-xs space-y-1.5 max-w-sm mx-auto text-slate-650">
            <p><strong>Campaign Name:</strong> {name}</p>
            <p><strong>Target Platforms:</strong> {platforms.join(", ").toUpperCase()}</p>
            <p><strong>Total Budget:</strong> ₹{budget.toLocaleString("en-IN")}</p>
          </div>

          <div className="pt-4 flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-[#ff6f00] hover:bg-[#e65c00] px-6 py-3 text-xs font-bold text-white transition"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/dashboard/campaigns"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              View Campaigns List
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
