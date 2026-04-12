import type { ReactNode } from "react"

interface CardProps {
  title: string
  description?: string
  children: ReactNode
}

export function Card({ title, description, children }: CardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-700">
          {title}
        </p>
        {description ? (
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  )
}
