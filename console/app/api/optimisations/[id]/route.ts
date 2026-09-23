import { NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/store"
import { applyOptimization } from "@/lib/apply"

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
  const now = new Date()

  if (body.status === "rejected") {
    const rejected = await store.updateOptimization(id, {
      status: "rejected",
      decidedBy: "u_am1", // TODO: signed-in user once auth lands
      decidedAt: now.toISOString(),
    })
    return rejected
      ? NextResponse.json({ optimization: rejected })
      : NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  // Approve and apply in one action — that is what the button promises.
  const all = await store.listOptimizations()
  const optimization = all.find((o) => o.id === id)
  if (!optimization) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const campaigns = await store.listCampaigns(optimization.dealerId)
  const campaign = campaigns.find((c) => c.id === optimization.campaignId)
  if (!campaign) {
    return NextResponse.json(
      { error: "The campaign this change belongs to no longer exists." },
      { status: 409 },
    )
  }

  const outcome = await applyOptimization({
    optimization,
    campaign,
    recentlyApplied: all.filter(
      (o) => o.campaignId === optimization.campaignId && o.appliedAt,
    ),
    now,
  })

  const updated = await store.updateOptimization(id, {
    status: outcome.applied ? "applied" : "approved",
    decidedBy: "u_am1", // TODO: signed-in user once auth lands
    decidedAt: now.toISOString(),
    appliedAt: outcome.applied ? now.toISOString() : null,
  })

  // Approved-but-not-applied is a real state, not a failure. The decision is
  // recorded; the write is deferred or has to happen in the platform.
  return NextResponse.json({ optimization: updated, outcome }, { status: 200 })
}
