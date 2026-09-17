import { NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/store"

const Body = z.object({
  status: z.enum(["activated", "rejected"]),
  rejectedReason: z.string().max(500).optional(),
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
  const updated = await store.updateOrder(id, {
    status: body.status,
    activatedBy: "u_am1", // TODO: signed-in user once auth lands
    activatedAt: new Date().toISOString(),
    rejectedReason: body.rejectedReason ?? null,
  })

  if (!updated) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 })
  }
  return NextResponse.json({ order: updated })
}
