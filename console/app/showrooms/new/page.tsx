import Link from "next/link"
import { Shell } from "@/components/Shell"
import { ShowroomForm } from "./ShowroomForm"

export const dynamic = "force-dynamic"

export default function NewShowroom() {
  return (
    <Shell
      title="Add showroom"
      subtitle="A new dealership client"
      actions={<Link href="/" className="btn-quiet">Back to book</Link>}
    >
      <ShowroomForm />
    </Shell>
  )
}
