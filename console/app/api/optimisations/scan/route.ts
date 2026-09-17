import { NextResponse } from "next/server"
import { detect } from "@/lib/optimizer"
import { getStore } from "@/lib/store"

/**
 * Run detection across every active dealer and queue what it finds.
 *
 * Triggered on a schedule (Cloud Scheduler every 30 minutes) rather than
 * continuously. The observation loop is what runs around the clock; changes
 * are batched deliberately — Meta allows only 4 ad-set budget changes an hour,
 * and resetting the platforms' learning phase with constant edits makes results
 * worse, not better.
 *
 * Detection is idempotent: a proposal already sitting in the queue for the same
 * campaign and kind is not duplicated on the next pass.
 */
export async function POST(req: Request) {
  // Cloud Scheduler calls this without a browser session, so it authenticates
  // with a shared secret instead of the console's access gate.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }

  const store = await getStore()
  const [dealers, existing] = await Promise.all([
    store.listDealers(),
    store.listOptimizations("proposed"),
  ])

  const openKeys = new Set(existing.map((o) => `${o.campaignId}:${o.kind}`))

  let created = 0
  let skipped = 0
  const now = new Date()

  for (const dealer of dealers) {
    if (dealer.status !== "active") continue

    const [campaigns, metrics] = await Promise.all([
      store.listCampaigns(dealer.id),
      store.listMetrics(dealer.id),
    ])
    if (campaigns.length === 0) continue

    for (const proposal of detect({ dealer, campaigns, metrics, now })) {
      const key = `${proposal.campaignId}:${proposal.kind}`
      if (openKeys.has(key)) {
        skipped++
        continue
      }
      openKeys.add(key)

      await store.createOptimization({
        campaignId: proposal.campaignId,
        dealerId: proposal.dealerId,
        kind: proposal.kind,
        rationale: proposal.rationale,
        proposedChange: proposal.proposedChange,
        priorState: proposal.priorState,
        requiresApproval: proposal.requiresApproval,
        status: "proposed",
        // Proposals inherit the provenance of the data they were derived from.
        provenance: metrics[0]?.provenance ?? "simulated",
        decidedBy: null,
        decidedAt: null,
        appliedAt: null,
      })
      created++
    }
  }

  return NextResponse.json({ created, skipped, scannedAt: now.toISOString() })
}
