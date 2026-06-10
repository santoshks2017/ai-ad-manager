"use client"

import { useState, type ReactNode } from "react"
import Sidebar from "../../components/ui/Sidebar"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()

  // Dynamic Page Title mapping
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Showrooms Console"
    if (pathname.startsWith("/dashboard/campaigns/new")) return "Create Campaign"
    if (pathname.startsWith("/dashboard/campaigns")) return "Campaigns Console"
    if (pathname.startsWith("/dashboard/leads")) return "Leads Inbox"
    if (pathname.startsWith("/dashboard/budget")) return "Budget Manager"
    if (pathname.startsWith("/dashboard/reports")) return "Weekly Reports"
    if (pathname.startsWith("/dashboard/settings")) return "Settings"
    return "Dashboard"
  }

  const userInitials = session?.user?.name
    ? session.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : session?.user?.email?.slice(0, 2).toUpperCase() || "SS"

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f6f8] text-slate-900">
      {/* 1. Desktop Left Sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block h-full">
        <Sidebar />
      </aside>

      {/* 2. Mobile Slide-over Drawer Menu */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Slide-over panel */}
          <div className="relative flex w-64 flex-1 flex-col bg-[#f4f6f8] shadow-2xl animate-in slide-in-from-left duration-150">
            <div className="absolute right-4 top-4 z-10">
              <button
                onClick={() => setIsMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto h-full">
              <Sidebar onClose={() => setIsMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Frame (Top Header + Scrollable Content) */}
      <div className="flex flex-1 flex-col overflow-hidden h-full">
        {/* Top Header Bar */}
        <header className="flex h-16 w-full items-center justify-between border-b border-slate-250 bg-white px-6 shrink-0">
          {/* Mobile Menu Trigger & Path Indicator */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>▼</span>
              <span className="text-slate-800 font-bold text-sm tracking-tight">{getPageTitle()}</span>
            </div>
          </div>

          {/* Right Header: Theme Toggle, Notifications, User Widget */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle (Sun icon) */}
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 transition">
              ☀️
            </button>

            {/* Notification Bell */}
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 transition relative">
              🔔
              <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>

            {/* User monograms Profile Badge */}
            <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50/70 py-1.5 pl-2.5 pr-4 shadow-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7000df] text-white text-[10px] font-bold tracking-tight">
                {userInitials}
              </div>
              <div className="text-left leading-tight">
                <p className="text-[11px] font-bold text-slate-800 truncate max-w-[100px]">
                  {session?.user?.name || "Santosh Sharma"}
                </p>
                <p className="text-[9px] text-slate-400 font-semibold tracking-wide uppercase">
                  {session?.user?.email?.includes("maruti") ? "Dealer Principal" : "Owner"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 bg-[#f4f6f8]">
          {children}
        </main>
      </div>
    </div>
  )
}
