"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"

const navItems = [
  { label: "Showrooms", href: "/dashboard", icon: "📊" },
  { label: "Campaigns Console", href: "/dashboard/campaigns", icon: "🚀" },
  { label: "Leads Inbox", href: "/dashboard/leads", icon: "📥" },
  { label: "Budget Manager", href: "/dashboard/budget", icon: "💳" },
  { label: "Reports", href: "/dashboard/reports", icon: "📈" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col justify-between bg-[#f4f6f8] border-r border-slate-200 py-6 px-4">
      <div className="space-y-8">
        {/* Brand Logo - CarDekho Style */}
        <div className="flex items-center gap-3 px-2">
          {/* Blue CD Icon Box */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0052cc] text-white font-extrabold text-sm tracking-tight shrink-0 shadow-sm">
            CD
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-slate-800 tracking-tight">CarDekho</span>
              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 rounded px-1.5 py-0.2 select-none uppercase">NCBD</span>
            </div>
            <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">AdManager Console</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 py-3 px-3 text-xs font-semibold transition-all relative rounded-lg ${
                    isActive
                      ? "bg-[#eaf5f5] text-[#008075] font-bold"
                      : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
                  }`}
                >
                  {/* Left Teal Active Bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#00a294] rounded-r-md" />
                  )}
                  
                  <span className={`text-sm transition group-hover:scale-110 duration-150 ${isActive ? "text-[#008075]" : "text-slate-400"}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Footer Support Info & Sign Out */}
      <div className="space-y-4 pt-4 border-t border-slate-200/70 px-2">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-medium">Client Support:</p>
          <a
            href="mailto:ncbd-support@cardekho.com"
            className="text-[11px] font-bold text-slate-700 hover:text-brand-600 transition"
          >
            ncbd-support@cardekho.com
          </a>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-2.5 text-xs font-bold text-red-650 transition hover:bg-red-50"
        >
          <span>Log Out</span>
        </button>
      </div>
    </div>
  )
}
