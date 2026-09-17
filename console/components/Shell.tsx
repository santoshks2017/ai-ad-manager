import Link from "next/link"
import { storeMode } from "@/lib/store"

const NAV = [
  { href: "/", label: "Dealers" },
  { href: "/quote", label: "Quote" },
  { href: "/activations", label: "Activations" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/analytics", label: "Analytics" },
  { href: "/optimisations", label: "Optimisations" },
  { href: "/setup", label: "Setup" },
]

export function Shell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const mode = storeMode()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <nav className="md:w-52 shrink-0 bg-surface border-b md:border-b-0 md:border-r border-rule">
        <div className="px-5 py-5 border-b border-rule">
          <Link href="/" className="block">
            <div className="font-display font-extrabold text-[15px] tracking-tight leading-none">
              AD MANAGER
            </div>
            <div className="eyebrow mt-1.5">Agency console</div>
          </Link>
        </div>
        <ul className="flex md:block overflow-x-auto">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block px-5 py-2.5 text-sm text-ink-soft hover:text-ink
                           hover:bg-ground whitespace-nowrap border-b border-transparent
                           md:border-b-0"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 min-w-0">
        <header className="px-5 md:px-8 py-5 border-b border-rule bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-ink-soft mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <DataModeBadge mode={mode} />
            </div>
          </div>
        </header>
        <div className="px-5 md:px-8 py-6">{children}</div>
      </main>
    </div>
  )
}

/**
 * States plainly whether the figures on screen came from a live platform or
 * the simulator. The previous build hid this behind an env var and returned
 * fabricated IDs silently; that made "is this real?" unanswerable. It is now
 * always on screen.
 */
function DataModeBadge({ mode }: { mode: "firestore" | "memory" }) {
  if (mode === "firestore") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs
                       uppercase tracking-[0.1em] font-medium bg-signal-soft
                       text-signal border border-signal/20">
        <span className="w-1.5 h-1.5 rounded-full bg-signal" />
        Live store
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs uppercase
                 tracking-[0.1em] font-medium bg-amber-soft text-amber
                 border border-amber/25"
      title="Figures on this screen are generated sample data, not real campaign performance."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber" />
      Sample data
    </span>
  )
}
