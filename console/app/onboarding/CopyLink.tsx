"use client"

import { useState } from "react"

export function CopyLink({
  token,
  dealerName,
}: {
  token: string
  dealerName: string
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null)

  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/onboard/${token}`
      : `/onboard/${token}`

  async function copy(what: "link" | "message") {
    const text =
      what === "link"
        ? link
        : [
            `Hello ${dealerName},`,
            "",
            "To start running your campaigns we need to connect your advertising accounts. " +
              "This link walks you through it — about ten minutes.",
            "",
            link,
            "",
            "You will own the accounts and keep everything in them. We run the campaigns " +
              "for you and handle the platform payments.",
            "",
            "Call us if anything is unclear and we will do it together on the phone.",
          ].join("\n")

    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard can be blocked; the link is visible on the dealer page anyway.
    }
  }

  return (
    <div className="flex gap-2">
      <button className="btn-quiet" onClick={() => copy("link")}>
        {copied === "link" ? "Copied" : "Copy link"}
      </button>
      <button className="btn-primary" onClick={() => copy("message")}>
        {copied === "message" ? "Copied" : "Copy WhatsApp message"}
      </button>
    </div>
  )
}
