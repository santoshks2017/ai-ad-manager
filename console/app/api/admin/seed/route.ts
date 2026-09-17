import { NextResponse } from "next/server"
import { getStore, storeMode } from "@/lib/store"
import { seed } from "@/lib/seed"

/**
 * Populate an empty store with sample data.
 *
 * Everything written carries provenance "simulated" and the console labels it
 * as sample data on every screen. This exists so a fresh Firestore database is
 * demonstrable; it is not a fixture for real dealer records.
 *
 * Refuses to run against a store that already holds dealers, so it cannot
 * quietly duplicate or overwrite real data once the console is in use.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 })
  }

  const store = await getStore()
  const existing = await store.listDealers()

  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: "Store already has data. Seeding would duplicate it.",
        dealers: existing.length,
        mode: storeMode(),
      },
      { status: 409 },
    )
  }

  await seed(store)
  const dealers = await store.listDealers()

  return NextResponse.json({
    seeded: true,
    mode: storeMode(),
    dealers: dealers.length,
    note: "All seeded records are marked simulated, not real campaign data.",
  })
}
