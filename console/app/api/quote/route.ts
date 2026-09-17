import { NextResponse } from "next/server"
import { z } from "zod"
import { project } from "@/lib/projection"
import { getStore } from "@/lib/store"
import type { HistoricalSample } from "@/lib/projection"
import type { Objective } from "@/lib/types"

const Body = z.object({
  budget: z.number().min(5_000).max(50_000_000),
  city: z.string().min(2).max(60),
  brand: z.string().min(2).max(40),
  model: z.string().min(1).max(40),
  objective: z.enum([
    "leads", "test_drive", "exchange", "model_launch", "festive_offer",
  ]),
  durationDays: z.number().min(7).max(365).default(30),
  save: z.boolean().default(false),
})

export async function POST(req: Request) {
  let parsed
  try {
    parsed = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: "Check the inputs — budget, city, brand, model and objective are all required." },
      { status: 400 },
    )
  }

  const store = await getStore()

  // Prefer our own results for this segment over category benchmarks. The
  // engine reports which basis it used, so a thin sample never masquerades as
  // a confident forecast.
  const historical = await findHistorical(
    store,
    parsed.city,
    parsed.model,
    parsed.objective,
  )

  const output = project(
    {
      budget: parsed.budget,
      city: parsed.city,
      brand: parsed.brand,
      model: parsed.model,
      objective: parsed.objective,
      durationDays: parsed.durationDays,
    },
    { historical },
  )

  if (parsed.save) {
    const saved = await store.createProjection({
      input: {
        budget: parsed.budget,
        city: parsed.city,
        brand: parsed.brand,
        model: parsed.model,
        objective: parsed.objective,
        durationDays: parsed.durationDays,
      },
      output,
      createdBy: "u_sales1", // TODO: replace with the signed-in user once auth lands
    })
    return NextResponse.json({ projection: saved, output })
  }

  return NextResponse.json({ output })
}

/**
 * Pull our own delivered CPL for dealers matching this city, model AND
 * objective.
 *
 * Matching on objective is not optional. A test-drive booking costs markedly
 * more per lead than a general enquiry, so projecting a test drive from
 * general-enquiry history understates CPL — exactly the kind of quiet
 * under-quote that turns into a dispute at invoice time. If we have not run
 * this objective in this segment, we return nothing and the engine falls back
 * to benchmarks at low confidence, which is the honest answer.
 */
async function findHistorical(
  store: Awaited<ReturnType<typeof getStore>>,
  city: string,
  model: string,
  objective: Objective,
): Promise<HistoricalSample[]> {
  const dealers = await store.listDealers()
  const matches = dealers.filter(
    (d) =>
      d.city.toLowerCase() === city.trim().toLowerCase() &&
      d.models.some((m) => m.toLowerCase() === model.trim().toLowerCase()),
  )
  if (matches.length === 0) return []

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
  const samples: HistoricalSample[] = []

  for (const d of matches) {
    const campaigns = await store.listCampaigns(d.id)
    const relevant = new Set(
      campaigns.filter((c) => c.objective === objective).map((c) => c.id),
    )
    if (relevant.size === 0) continue

    const metrics = (await store.listMetrics(d.id, since)).filter(
      (m) => m.campaignId && relevant.has(m.campaignId),
    )

    const byPlatform = new Map<string, { spend: number; leads: number }>()
    for (const m of metrics) {
      const acc = byPlatform.get(m.platform) ?? { spend: 0, leads: 0 }
      acc.spend += m.spend
      acc.leads += m.leads
      byPlatform.set(m.platform, acc)
    }
    for (const [platform, agg] of byPlatform) {
      if (agg.leads > 0) {
        samples.push({
          platform: platform as "google" | "meta",
          cpl: agg.spend / agg.leads,
          leads: agg.leads,
        })
      }
    }
  }
  return samples
}
