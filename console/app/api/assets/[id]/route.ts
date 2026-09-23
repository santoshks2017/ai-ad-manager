import { NextResponse } from "next/server"
import { getStore } from "@/lib/store"
import { canOperate, currentUser } from "@/lib/session"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser()
  if (!user || !canOperate(user.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 })
  }

  const { id } = await params
  const store = await getStore()
  // The Storage object is left in place deliberately: a live campaign may still
  // reference it, and an ad that suddenly loses its image is worse than an
  // orphaned file costing fractions of a rupee.
  const removed = await store.deleteImage(id)
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Not found." }, { status: 404 })
}
