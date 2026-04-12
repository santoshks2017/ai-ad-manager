import type { ButtonHTMLAttributes } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary"
}

const variantStyles = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50",
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold transition ${variantStyles[variant]} ${className}`}
      {...props}
    />
  )
}
