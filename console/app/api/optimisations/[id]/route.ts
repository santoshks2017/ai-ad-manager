import { NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/store"

const Body = z.object({ status: z.enum(["approved", "rejected"]) })

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const store = await getStore()
  const now = new Date().toISOString()

  // Approval records the decision. Applying it against the live platform is a
  // separate step handled by the apply queue, which is rate-limit aware — the
  // decision and the API call must not be the same action, or a burst of
  // approvals would breach Meta's 4-changes-per-hour ceiling.
  const updated = await store.updateOptimization(id, {
    status: body.status === "approved" ? "approved" : "rejected",
    decidedBy: "u_am1", // TODO: signed-in user once auth lands
    decidedAt: now,
  })

  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }
  return NextResponse.json({ optimization: updated })
}
