"use client"

import { useEffect, useState } from "react"
import { api } from "../../../lib/api"

export default function BudgetPage() {
  const [settings, setSettings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Local edit states
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null)
  const [editCap, setEditCap] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [saving, setSaving] = useState(false)

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.budget.settings()
      setSettings(data)
    } catch (err) {
      console.error(err)
      setError("Failed to load budget controls. Ensure the backend server is running.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const startEdit = (setting: any) => {
    setEditingPlatform(setting.platform)
    setEditCap(setting.monthlyCap.toString())
    setEditPhone(setting.phoneForSms || "")
  }

  const handleSave = async (platform: string) => {
    setSaving(true)
    try {
      const current = settings.find(s => s.platform === platform)
      const payload = {
        platform,
        monthlyCap: Number(editCap) || 0,
        alert75Email: current.alert75Email,
        alert95Email: current.alert95Email,
        alert95Sms: current.alert95Sms,
        phoneForSms: editPhone
      }
      
      await api.budget.update(payload)
      setEditingPlatform(null)
      await loadSettings()
    } catch (err) {
      console.error(err)
      alert("Failed to save budget settings.")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAlert = async (platform: string, alertField: string, currentValue: boolean) => {
    try {
      const current = settings.find(s => s.platform === platform)
      const payload = {
        platform,
        monthlyCap: current.monthlyCap,
        alert75Email: current.alert75Email,
        alert95Email: current.alert95Email,
        alert95Sms: current.alert95Sms,
        phoneForSms: current.phoneForSms,
        [alertField]: !currentValue
      }
      await api.budget.update(payload)
      await loadSettings()
    } catch (err) {
      console.error(err)
    }
  }

  const handlePauseAll = async () => {
    const confirm = window.confirm(
      "⚠️ WARNING: This will immediately pause all active advertising campaigns on both Google Ads and Meta Ads. Are you sure?"
    )
    if (!confirm) return

    setLoading(true)
    try {
      const res = await api.budget.pauseAll()
      if (res.success) {
        alert(res.message)
      }
      await loadSettings()
    } catch (err) {
      console.error(err)
      alert("Failed to pause campaigns.")
    } finally {
      setLoading(false)
    }
  }

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading && settings.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#008075]" />
          <p className="text-xs font-semibold text-slate-500 font-sans">Loading budget configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#008075]">
              Budget Controls
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
              Spend Controls for Google & Meta
            </h1>
            <p className="mt-1 text-slate-500 text-xs">
              Set monthly caps, track real-time spend progress, and configure automated SMS and email alerts.
            </p>
          </div>
          <div>
            <button
              onClick={handlePauseAll}
              className="rounded-xl bg-red-650 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-red-750 shadow-xs inline-flex items-center justify-center gap-1.5"
            >
              🛑 Emergency Pause All Ads
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid of platforms */}
      <div className="grid gap-6 md:grid-cols-2">
        {settings.map((item) => {
          const isEditing = editingPlatform === item.platform
          const barColor = item.progress >= 95 ? "bg-red-600" : item.progress >= 75 ? "bg-amber-500" : "bg-[#00a294]"
          
          return (
            <div
              key={item.platform}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-5"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {item.platform} Ads account
                  </p>
                  {isEditing ? (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold text-lg">₹</span>
                      <input
                        type="number"
                        value={editCap}
                        onChange={e => setEditCap(e.target.value)}
                        className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-[#008075] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-xl font-extrabold text-slate-900 tracking-tight">
                      {formatINR(item.monthlyCap)}
                    </p>
                  )}
                </div>
                <div>
                  {isEditing ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleSave(item.platform)}
                        disabled={saving}
                        className="bg-[#ff6f00] hover:bg-[#e65c00] text-white text-[10px] font-bold rounded-lg px-2.5 py-1.5 uppercase transition disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPlatform(null)}
                        className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg px-2.5 py-1.5 uppercase transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(item)}
                      className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg px-3 py-2 uppercase tracking-wider transition shadow-xs"
                    >
                      Adjust Cap
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Month-to-Date Spend</span>
                  <span className="font-bold text-slate-800">{formatINR(item.spent)} / {formatINR(item.monthlyCap)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 border border-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${Math.min(item.progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                  <span>{item.progress}% Consumed</span>
                  <span>Projected month end: <strong className="text-slate-950 font-bold">{formatINR(item.projected)}</strong></span>
                </div>
              </div>

              {/* Alert Controls */}
              <div className="border-t border-slate-150/60 pt-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Platform alert triggers</p>
                
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-2 font-medium text-slate-600">
                    ✉️ Email alert at 75% cap
                  </span>
                  <button
                    onClick={() => handleToggleAlert(item.platform, "alert75Email", item.alert75Email)}
                    className={`h-5 w-9 rounded-full p-0.5 transition duration-150 ${
                      item.alert75Email ? "bg-[#008075] text-right" : "bg-slate-200 text-left"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                      item.alert75Email ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-2 font-medium text-slate-600">
                    ✉️ Email alert at 95% cap
                  </span>
                  <button
                    onClick={() => handleToggleAlert(item.platform, "alert95Email", item.alert95Email)}
                    className={`h-5 w-9 rounded-full p-0.5 transition duration-150 ${
                      item.alert95Email ? "bg-[#008075] text-right" : "bg-slate-200 text-left"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                      item.alert95Email ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-2 font-medium text-slate-600">
                    📱 SMS alert at 95% cap
                  </span>
                  <button
                    onClick={() => handleToggleAlert(item.platform, "alert95Sms", item.alert95Sms)}
                    className={`h-5 w-9 rounded-full p-0.5 transition duration-150 ${
                      item.alert95Sms ? "bg-[#008075] text-right" : "bg-slate-200 text-left"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-150 ${
                      item.alert95Sms ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {isEditing ? (
                  <div className="pt-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Mobile number for SMS Alerts</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-[#008075] focus:outline-none"
                    />
                  </div>
                ) : (
                  item.phoneForSms && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 pt-1.5 font-semibold">
                      <span>🔔</span>
                      SMS Alerts will be sent to: {item.phoneForSms}
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
