"use client"

import { useEffect, useState } from "react"
import { api } from "../../../lib/api"

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  
  // Selected report for detail Modal
  const [selectedReport, setSelectedReport] = useState<any>(null)

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.reports.list()
      setReports(data)
      // Auto select first report for default insight view
      if (data.length > 0 && !selectedReport) {
        setSelectedReport(data[0])
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load reports history. Ensure the backend server is running.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleSendNow = async () => {
    setSending(true)
    try {
      const res = await api.reports.sendNow()
      if (res.success) {
        alert(res.message || "Report dispatched successfully!")
      }
      await loadReports()
    } catch (err) {
      console.error(err)
      alert("Failed to send report. Review mail services configuration.")
    } finally {
      setSending(false)
    }
  }

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDateRange = (startStr: string, endStr: string) => {
    const start = new Date(startStr)
    const end = new Date(endStr)
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
    return `${start.toLocaleDateString("en-IN", options)} – ${end.toLocaleDateString("en-IN", options)}`
  }

  if (loading && reports.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#008075]" />
          <p className="text-xs font-semibold text-slate-500 font-sans">Loading performance reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#008075]">
              Performance Reports
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
              Weekly Performance Summary
            </h1>
            <p className="mt-1 text-slate-500 text-xs">
              Review and download pre-compiled weekly performance summaries. You can trigger an immediate delivery to your inbox.
            </p>
          </div>
          <button
            onClick={handleSendNow}
            disabled={sending}
            className="rounded-xl bg-[#ff6f00] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#e65c00] disabled:opacity-50 shadow-xs inline-flex items-center justify-center gap-1.5"
          >
            {sending ? "Compiling..." : "✉️ Send Latest Report"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid: Left - History, Right - Details */}
      <div className="grid gap-6 lg:grid-cols-[1.8fr_1.2fr] items-start">
        {/* Left Side: Report History Cards */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Past reports history</h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {reports.length === 0 ? (
              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-xs font-medium">
                No reports generated yet. Click "Send Latest Report" to run one.
              </div>
            ) : (
              reports.map((report) => {
                const isSelected = selectedReport?.id === report.id
                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`cursor-pointer rounded-2xl border p-5 shadow-xs transition duration-155 flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? "border-[#008075] bg-[#eaf5f5]/30"
                        : "border-slate-200 bg-white hover:border-slate-350"
                    }`}
                  >
                    <div>
                      <p className="text-[10px] font-bold text-[#008075] uppercase tracking-wider">
                        {formatDateRange(report.periodStart, report.periodEnd)}
                      </p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900 tracking-tight">
                        {formatINR(report.totalSpend)}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-100/60 font-semibold text-slate-600">
                      <div>
                        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Leads</p>
                        <p className="font-extrabold text-slate-900 mt-0.5">{report.totalLeads}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">CPL</p>
                        <p className="font-extrabold text-slate-900 mt-0.5">{formatINR(report.cpl)}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Side: Selected Report Panel Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5 sticky top-6">
          <div className="border-b border-slate-100 pb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report details viewer</span>
          </div>

          {selectedReport ? (
            <div className="space-y-5">
              <div className="bg-slate-50/70 p-4.5 rounded-xl border border-slate-150/70">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Performance window</p>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {formatDateRange(selectedReport.periodStart, selectedReport.periodEnd)}
                </h3>
                
                <div className="mt-4 space-y-2.5 text-xs font-semibold text-slate-600">
                  <div className="flex items-center justify-between border-b border-slate-100/40 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Total Spend:</span>
                    <span className="font-extrabold text-slate-900">{formatINR(selectedReport.totalSpend)}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100/40 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Leads Captured:</span>
                    <span className="font-extrabold text-slate-900">{selectedReport.totalLeads}</span>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100/40 pb-2">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Average CPL:</span>
                    <span className="font-extrabold text-slate-900">{formatINR(selectedReport.cpl)}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Top Campaign:</span>
                    <span className="font-extrabold text-slate-900 truncate max-w-[120px]">
                      {selectedReport.topCampaignName || "Exchange Offer"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly insight card */}
              <div className="bg-[#eaf5f5]/65 rounded-xl p-4.5 border border-[#008075]/20 leading-relaxed space-y-1.5">
                <span className="text-[9px] font-bold text-[#008075] uppercase tracking-wider">Weekly insight</span>
                <p className="text-xs font-bold text-slate-900">{selectedReport.insightText}</p>
                <p className="text-[10px] text-slate-500 font-medium">Auto-generated plain language summary for dealership owners.</p>
              </div>

              <div className="flex gap-2">
                <a
                  href={selectedReport.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  📄 Download PDF
                </a>
                <button
                  onClick={handleSendNow}
                  disabled={sending}
                  className="flex-1 rounded-xl bg-[#ff6f00] py-3 text-xs font-bold text-white hover:bg-[#e65c00] transition shadow-sm"
                >
                  Forward Email
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              Select a report card to view weekly insights.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
