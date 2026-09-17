import { Shell } from "@/components/Shell"
import { QuoteForm } from "./QuoteForm"

export const dynamic = "force-dynamic"

export default function QuotePage() {
  return (
    <Shell
      title="Quote"
      subtitle="Budget in, deliverable leads out — while the dealer is still in the room"
    >
      <QuoteForm />
    </Shell>
  )
}
