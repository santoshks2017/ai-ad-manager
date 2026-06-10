"use client"

import { useEffect, useState, useRef } from "react"
import { api } from "../../../lib/api"

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  
  // Filters and search states
  const [status, setStatus] = useState("all")
  const [platform, setPlatform] = useState("all")
  const [campaignId, setCampaignId] = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)
  
  // Mask states
  const [unmaskedLeadIds, setUnmaskedLeadIds] = useState<Record<string, boolean>>({})
  
  // Notes auto-save state
  const [notesText, setNotesText] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadLeads = async (pageNumber = 1) => {
    setLoading(true)
    try {
      const data = await api.leads.list({
        status,
        platform,
        campaignId,
        search,
        page: pageNumber
      })
      setLeads(data.leads)
      setPagination(data.pagination)
      setPage(pageNumber)
      
      // Auto select first lead if none selected
      if (data.leads.length > 0 && !selectedLead) {
        selectLeadItem(data.leads[0])
      }
    } catch (err) {
      console.error("Failed to load leads:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadCampaignsList = async () => {
    try {
      const data = await api.campaigns.list()
      setCampaigns(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadCampaignsList()
  }, [])

  // Reload leads when filter options change
  useEffect(() => {
    loadLeads(1)
  }, [status, platform, campaignId, search])

  // Periodic polling for sandbox (refresh every 10 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      loadLeads(page)
    }, 10000)
    return () => clearInterval(timer)
  }, [status, platform, campaignId, search, page])

  const selectLeadItem = (lead: any) => {
    setSelectedLead(lead)
    setNotesText(lead.notes || "")
    setSaveStatus("idle")
  }

  const handleMaskToggle = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setUnmaskedLeadIds(prev => ({
      ...prev,
      [leadId]: !prev[leadId]
    }))
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await api.leads.update(leadId, { status: newStatus })
      
      // Update local state
      setLeads((prev: any[]) => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev: any) => ({ ...prev, status: newStatus }))
      }
    } catch (err) {
      console.error(err)
      alert("Failed to update status")
    }
  }

  // Debounced notes update
  const handleNotesChange = (text: string) => {
    setNotesText(text)
    setSaveStatus("saving")

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!selectedLead) return
      try {
        await api.leads.update(selectedLead.id, { notes: text })
        setSaveStatus("saved")
        
        // Update local state in list
        setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, notes: text } : l))
        setTimeout(() => setSaveStatus("idle"), 1500)
      } catch (err) {
        console.error(err)
        setSaveStatus("idle")
      }
    }, 500) // 500ms debounce
  }

  // Mask Phone utility
  const getMaskedPhone = (phone: string, leadId: string) => {
    if (!phone) return ""
    if (unmaskedLeadIds[leadId]) return phone
    
    // Mask middle 5 digits of Indian number
    const trimmed = phone.trim()
    if (trimmed.length >= 10) {
      const start = trimmed.slice(0, 4)
      const end = trimmed.slice(-4)
      return `${start} •••• ${end}`
    }
    return "••••••••••"
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#008075]">
              Leads Console
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
              Unified Lead Inbox
            </h1>
            <p className="mt-1 text-slate-500 text-xs">
              All Google Search and Meta Feed leads captured in real time. Tag statuses, log follow-up notes, and export CSV files.
            </p>
          </div>
          <div>
            <a
              href={api.leads.exportUrl({ status, platform, campaignId, search })}
              download
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition inline-flex items-center justify-center gap-1.5"
            >
              📥 Export CSV
            </a>
          </div>
        </div>

        {/* Filters and search box */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Search Name/Phone</label>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-[#008075] focus:bg-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Filter Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-[#008075] focus:bg-white focus:outline-none transition font-semibold"
            >
              <option value="all">All Platforms</option>
              <option value="google">Google Leads</option>
              <option value="meta">Meta Leads</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Filter Campaign</label>
            <select
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-[#008075] focus:bg-white focus:outline-none transition font-semibold"
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Filter Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-[#008075] focus:bg-white focus:outline-none transition font-semibold"
            >
              <option value="all">All Statuses</option>
              <option value="new">New Leads</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
        {/* Left Side: Lead List */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead records</span>
            <span className="rounded-full bg-[#eaf5f5] px-3 py-1 text-[10px] font-bold text-[#008075]">
              {pagination?.total || 0} total leads
            </span>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {leads.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs leading-relaxed font-medium">
                {loading ? "Refreshing inbox..." : "No leads in inbox. In Sandbox mode, a new simulated lead will arrive shortly."}
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => selectLeadItem(lead)}
                  className={`group cursor-pointer rounded-xl border p-4 transition duration-150 relative ${
                    selectedLead?.id === lead.id
                      ? "border-[#008075] bg-[#eaf5f5]/30 shadow-xs"
                      : "border-slate-200 hover:border-slate-350 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        {lead.name}
                        {lead.status === "new" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#008075] animate-pulse" />
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                        {getMaskedPhone(lead.phone, lead.id)}
                        <button
                          onClick={(e) => handleMaskToggle(lead.id, e)}
                          className="text-[9px] text-[#008075] hover:underline font-sans font-bold bg-[#eaf5f5] px-1.5 py-0.2 rounded"
                        >
                          {unmaskedLeadIds[lead.id] ? "Hide" : "Show"}
                        </button>
                      </p>
                    </div>
                    <span className={`rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase ${
                      lead.platform === "google"
                        ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                    }`}>
                      {lead.platform}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 pt-2.5 border-t border-slate-100/60 font-medium">
                    <span className="truncate max-w-[150px] text-slate-500">{lead.campaignName || "Custom Ad"}</span>
                    <span>{new Date(lead.receivedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {pagination && pagination.pages > 1 && (
            <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
              <button
                disabled={page <= 1}
                onClick={() => loadLeads(page - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Previous
              </button>
              <span className="text-[11px] text-slate-400 font-semibold">Page {page} of {pagination.pages}</span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => loadLeads(page + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Lead Details Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5 sticky top-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lead details</span>
            {saveStatus !== "idle" && (
              <span className={`text-[9px] font-bold rounded px-1.5 py-0.2 uppercase ${
                saveStatus === "saving" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
              }`}>
                {saveStatus === "saving" ? "Saving..." : "Saved ✓"}
              </span>
            )}
          </div>

          {selectedLead ? (
            <div className="space-y-5">
              <div className="bg-slate-50/70 p-4.5 rounded-xl border border-slate-150/70">
                <h3 className="text-base font-bold text-slate-900">{selectedLead.name}</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 capitalize">
                  Source: {selectedLead.platform} • Campaign: {selectedLead.campaignName || "Direct"}
                </p>
                
                <div className="mt-4 space-y-2.5 text-xs font-semibold text-slate-600">
                  <div className="flex items-center justify-between border-b border-slate-100/50 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Phone:</span>
                    <span className="text-slate-950 font-bold font-mono flex items-center gap-1.5">
                      {getMaskedPhone(selectedLead.phone, selectedLead.id)}
                      <button
                        onClick={(e) => handleMaskToggle(selectedLead.id, e)}
                        className="text-[9px] text-[#008075] hover:underline font-sans font-bold"
                      >
                        {unmaskedLeadIds[selectedLead.id] ? "Hide" : "Show"}
                      </button>
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100/50 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Email:</span>
                    <span className="text-slate-900">{selectedLead.email || "N/A"}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100/50 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Ingested:</span>
                    <span className="text-slate-500 font-medium">
                      {new Date(selectedLead.receivedAt).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Disposition:</span>
                    <select
                      value={selectedLead.status}
                      onChange={e => handleStatusChange(selectedLead.id, e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:border-[#008075] focus:outline-none"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Note input field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dealership Follow-up Notes</label>
                <textarea
                  value={notesText}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Log details of conversation (e.g. wants Brezza diesel automatic test drive, exchange evaluation set for Friday...)"
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-800 focus:border-[#008075] focus:ring-1 focus:ring-[#008075]/25 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="flex-1 rounded-xl bg-[#ff6f00] py-3 text-xs font-bold text-white hover:bg-[#e65c00] transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  📞 Call Lead
                </a>
                <button
                  onClick={() => handleStatusChange(selectedLead.id, "contacted")}
                  disabled={selectedLead.status === "contacted"}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 shadow-sm"
                >
                  Mark Contacted
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              Select a lead from the list to view detail panel.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

