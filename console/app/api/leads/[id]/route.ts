import { NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/store"

const Body = z.object({
  status: z.enum(["new", "contacted", "qualified", "lost"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

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
  const updated = await store.updateLead(id, body)
  if (!updated) return NextResponse.json({ error: "Lead not found." }, { status: 404 })
  return NextResponse.json({ lead: updated })
}
