"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "../../lib/api"

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>("week")
  
  // Custom date selection
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showCustomRange, setShowCustomRange] = useState(false)

  const loadMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.dashboard.metrics(
        period,
        period === "custom" ? startDate : undefined,
        period === "custom" ? endDate : undefined
      )
      setMetrics(data)
    } catch (err: any) {
      console.error(err)
      setError("Failed to load dashboard metrics. Ensure the backend server is running.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (period !== "custom") {
      loadMetrics()
    }
  }, [period])

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      loadMetrics()
    }
  }

  // Format currency
  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading && !metrics) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#008075]" />
          <p className="text-xs font-semibold text-slate-500 font-sans">Loading console metrics...</p>
        </div>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <p className="font-bold text-sm">{error}</p>
        <button
          onClick={loadMetrics}
          className="mt-4 rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  const { totalSpend = 0, totalLeads = 0, costPerLead = 0, activeCampaigns = 0, platformBreakdown = { google: { spend: 0, leads: 0 }, meta: { spend: 0, leads: 0 } }, trend = [], campaigns = [] } = metrics || {}

  const googleSpend = platformBreakdown.google?.spend || 0
  const metaSpend = platformBreakdown.meta?.spend || 0
  const totalCombinedSpend = googleSpend + metaSpend
  const googlePercent = totalCombinedSpend > 0 ? Math.round((googleSpend / totalCombinedSpend) * 100) : 50
  const metaPercent = totalCombinedSpend > 0 ? Math.round((metaSpend / totalCombinedSpend) * 100) : 50

  const renderTrendChart = () => {
    if (!trend || trend.length === 0) {
      return (
        <div className="flex h-36 items-center justify-center text-xs text-slate-400">
          No trend records found in range.
        </div>
      )
    }

    const width = 500
    const height = 150
    const padding = 20

    const leadsValues = trend.map((t: any) => t.leads || 0)
    const maxLeads = Math.max(...leadsValues, 5)

    const points = trend.map((t: any, index: number) => {
      const x = padding + (index / (trend.length - 1 || 1)) * (width - padding * 2)
      const y = height - padding - ((t.leads || 0) / maxLeads) * (height - padding * 2)
      return { x, y }
    })

    const pathData = points
      .map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ")

    const areaData = points.length > 0 
      ? `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` 
      : ""

    return (
      <svg className="w-full h-full max-h-36" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00a294" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00a294" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#f1f5f9" strokeWidth={1} />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f1f5f9" strokeWidth={1} />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e2e8f0" strokeWidth={1} />

        {areaData && <path d={areaData} fill="url(#chartGradient)" />}
        {pathData && <path d={pathData} fill="none" stroke="#00a294" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p: any, idx: number) => (
          <circle key={idx} cx={p.x} cy={p.y} r={3.5} fill="#008075" stroke="#ffffff" strokeWidth={1.5} />
        ))}
      </svg>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Showrooms Metrics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Consolidated service performance across all your connected Google and Meta ad accounts.
          </p>
        </div>
        
        {/* Actions - CarDekho primary button is orange */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/campaigns/new"
            className="inline-flex items-center justify-center rounded-xl bg-[#ff6f00] hover:bg-[#e65c00] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition"
          >
            + Create Campaign
          </Link>
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition"
          >
            Leads Inbox
          </Link>
        </div>
      </div>

      {/* Date filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-200/70 shadow-xs">
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-150">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "Last 7 Days" },
            { id: "month", label: "Last 30 Days" },
            { id: "custom", label: "Custom Range" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setPeriod(tab.id)
                setShowCustomRange(tab.id === "custom")
              }}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                period === tab.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {showCustomRange && (
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-750 focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 font-semibold uppercase">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-750 focus:outline-none"
            />
            <button
              onClick={handleApplyCustom}
              disabled={!startDate || !endDate}
              className="bg-[#008075] hover:bg-[#00665c] text-white rounded-lg px-3 py-1 text-[11px] font-bold disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Spend", value: formatINR(totalSpend), color: "text-slate-900" },
          { label: "Total Leads", value: totalLeads.toString(), color: "text-[#008075]" },
          { label: "Cost Per Lead", value: formatINR(costPerLead), color: "text-slate-900" },
          { label: "Active Campaigns", value: activeCampaigns.toString(), color: "text-slate-900" }
        ].map((card, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between h-28">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-bold tracking-tight mt-2 ${card.color}`}>{card.value}</p>
            <span className="text-[10px] text-slate-500 font-semibold mt-1">System aggregated</span>
          </div>
        ))}
      </div>

      {/* Middle Grid: Trend and Platform Splits */}
      <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
        {/* Daily trend graph */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead Velocity</p>
              <h2 className="text-base font-bold text-slate-800">Leads generated trend</h2>
            </div>
            <span className="rounded-lg bg-[#eaf5f5] text-[#008075] px-2 py-0.5 text-[10px] font-bold">
              Real-time
            </span>
          </div>

          <div className="mt-6 flex-1 min-h-[140px] flex items-end">
            {renderTrendChart()}
          </div>
        </div>

        {/* Spend Split */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spend split</p>
            <h2 className="text-base font-bold text-slate-800">Google vs Meta Ads</h2>
          </div>

          <div className="my-6 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-650">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#0052cc]" />
                  Google Ads
                </span>
                <span>{googlePercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#0052cc]" style={{ width: `${googlePercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">MTD: {formatINR(googleSpend)}</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-650">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#ff7c00]" />
                  Meta Ads
                </span>
                <span>{metaPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#ff7c00]" style={{ width: `${metaPercent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">MTD: {formatINR(metaSpend)}</p>
            </div>
          </div>

          <div className="bg-[#fcf8e3] text-[#8a6d3b] rounded-xl px-4 py-3 border border-[#faebcc] text-xs font-medium leading-relaxed">
            ⚡ Cost per Lead averages ₹{formatINR(costPerLead)}. Consider optimizing Google spend to boost overall volume.
          </div>
        </div>
      </div>

      {/* Campaigns performance table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-50">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top campaigns</p>
            <h2 className="text-base font-bold text-slate-800">Campaign performance</h2>
          </div>
          <Link
            href="/dashboard/campaigns"
            className="text-xs font-bold text-[#008075] hover:underline"
          >
            Manage Campaigns →
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700">
            <thead>
              <tr className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                <th className="pb-3 pt-2 font-bold">Campaign details</th>
                <th className="pb-3 pt-2 font-bold">Platforms</th>
                <th className="pb-3 pt-2 font-bold">Leads</th>
                <th className="pb-3 pt-2 font-bold">CPL</th>
                <th className="pb-3 pt-2 font-bold">Total Budget</th>
                <th className="pb-3 pt-2 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No active campaigns. Click "+ Create Campaign" above.
                  </td>
                </tr>
              ) : (
                campaigns.slice(0, 3).map((campaign: any) => {
                  const campCpl = campaign.leads > 0 ? campaign.spend / campaign.leads : 0
                  return (
                    <tr key={campaign.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 font-bold text-slate-900">{campaign.name}</td>
                      <td className="py-3.5 capitalize">
                        <span className="inline-flex gap-1">
                          {campaign.platforms?.map((p: string) => (
                            <span key={p} className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                              {p}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-slate-900">{campaign.leads}</td>
                      <td className="py-3.5 font-semibold text-slate-900">{formatINR(campCpl)}</td>
                      <td className="py-3.5 font-semibold text-slate-900">{formatINR(campaign.budget)}</td>
                      <td className="py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${
                            campaign.status === "active"
                              ? "bg-[#e3fcf7] text-[#00665c] border border-[#a2f2e5]"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {campaign.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
