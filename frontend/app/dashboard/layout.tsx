import type { ReactNode } from "react"
import Sidebar from "../../components/ui/Sidebar"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 sm:px-8">
        <aside className="hidden w-80 shrink-0 lg:block">
          <Sidebar />
        </aside>

        <section className="flex-1 space-y-6">{children}</section>
      </div>
    </div>
  )
}
