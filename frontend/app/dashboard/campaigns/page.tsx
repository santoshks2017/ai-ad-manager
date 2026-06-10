"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "../../../lib/api"

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const loadCampaigns = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.campaigns.list()
      setCampaigns(data)
    } catch (err) {
      console.error(err)
      setError("Failed to load campaigns list. Ensure the backend server is running.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setActionLoadingId(id)
    try {
      if (currentStatus === "active") {
        await api.campaigns.pause(id)
      } else {
        await api.campaigns.resume(id)
      }
      const updated = await api.campaigns.list()
      setCampaigns(updated)
    } catch (err) {
      console.error("Failed to toggle status:", err)
      alert("Failed to toggle status. Ad network API error.")
    } finally {
      setActionLoadingId(null)
    }
  }

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value)
  }

  const filteredCampaigns = campaigns.filter(c => {
    if (statusFilter === "all") return true
    return c.status === statusFilter
  })

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#008075]" />
          <p className="text-xs font-semibold text-slate-500 font-sans">Loading campaigns list...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Campaigns Console</h1>
          <p className="text-xs text-slate-500 mt-1">
            Review live campaign metrics across Google Ads and Meta Ads, and suspend/resume actions.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-xl bg-[#ff6f00] hover:bg-[#e65c00] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition inline-flex items-center justify-center"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Filter Row */}
      <div className="bg-white px-5 py-3 rounded-2xl border border-slate-200/70 shadow-xs flex gap-2">
        {[
          { id: "all", label: "All Campaigns" },
          { id: "active", label: "Active" },
          { id: "paused", label: "Paused" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition duration-150 ${
              statusFilter === tab.id
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
          <p className="font-bold text-sm">{error}</p>
        </div>
      )}

      {/* Campaigns Table Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700">
            <thead>
              <tr className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                <th className="px-4 py-3.5 font-bold">Campaign details</th>
                <th className="px-4 py-3.5 font-bold">Platforms</th>
                <th className="px-4 py-3.5 font-bold">Budget</th>
                <th className="px-4 py-3.5 font-bold">Leads</th>
                <th className="px-4 py-3.5 font-bold">Timeline</th>
                <th className="px-4 py-3.5 font-bold">Status</th>
                <th className="px-4 py-3.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No campaigns found matching selected filter.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{campaign.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Model: {campaign.carModel}</p>
                    </td>
                    <td className="px-4 py-3.5 capitalize">
                      <span className="flex flex-wrap gap-1">
                        {campaign.platforms?.map((p: string) => (
                          <span key={p} className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                            {p}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {formatINR(campaign.budget)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-[#008075]">
                      {campaign.leads}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(campaign.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - {new Date(campaign.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3.5">
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
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                        disabled={actionLoadingId === campaign.id}
                        className={`rounded-xl px-4.5 py-2 text-[11px] font-bold transition disabled:opacity-50 ${
                          campaign.status === "active"
                            ? "border border-red-200 bg-white text-red-500 hover:bg-red-50"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {actionLoadingId === campaign.id
                          ? "Loading..."
                          : campaign.status === "active"
                          ? "Pause Ads"
                          : "Resume"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
