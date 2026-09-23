import { NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/store"
import { actorId, currentUser } from "@/lib/session"
import { getProvider } from "@/lib/providers"
import type { CreateCampaignInput } from "@/lib/providers"
import type { Campaign, Platform } from "@/lib/types"

const Body = z.object({
  dealerId: z.string().min(1),
  model: z.string().min(1).max(60),
  objective: z.enum(["leads", "test_drive", "exchange", "model_launch", "festive_offer"]),
  platforms: z.array(z.enum(["google", "meta"])).min(1),
  monthlyBudget: z.number().min(5_000).max(50_000_000),
  metaSharePct: z.number().min(0).max(100).default(65),
  radiusKm: z.number().min(1).max(200).default(25),
  startDate: z.string(),
  endDate: z.string().nullable().default(null),
  headline: z.string().min(3).max(120),
  description: z.string().min(3).max(300),
  offer: z.string().max(120).nullable().default(null),
  goLive: z.boolean().default(false),
})

/**
 * Create a campaign for a dealer across the selected platforms.
 *
 * Two things this deliberately does NOT do:
 *
 *   - It does not launch. Both providers create campaigns PAUSED. Spend cannot
 *     be unwound, so nothing goes live until a human has looked at it.
 *   - It does not roll back a partial failure. If Google succeeds and Meta
 *     fails, the Google campaign stays and the response says so. Silently
 *     deleting a campaign that was created correctly is worse than reporting a
 *     half-finished job — and the paused campaign is spending nothing meanwhile.
 */
export async function POST(req: Request) {
  let body
  try {
    body = Body.parse(await req.json())
  } catch (err) {
    return NextResponse.json(
      { error: "Check the campaign details — something is missing or out of range." },
      { status: 400 },
    )
  }

  const store = await getStore()
  const dealer = await store.getDealer(body.dealerId)
  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found." }, { status: 404 })
  }

  // Compliance gate. Both platforms require a separate ad account per
  // advertiser, and Meta requires a Page that represents the dealer. Running
  // without the signed agreement means advertising as someone's representative
  // without authorisation.
  const blockers: string[] = []
  if (!dealer.platform?.servicesAgreementSigned) {
    blockers.push("the services agreement is unsigned")
  }
  for (const p of body.platforms) {
    if (p === "google" && dealer.platform?.googleState !== "ready") {
      blockers.push("the Google Ads account is not ready")
    }
    if (p === "meta" && dealer.platform?.metaState !== "ready") {
      blockers.push("the Meta Page and ad account are not ready")
    }
  }
  if (blockers.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot create campaigns for ${dealer.name}: ${blockers.join(", ")}.`,
        blockers,
      },
      { status: 409 },
    )
  }

  const metaShare = body.metaSharePct / 100
  const created: Campaign[] = []
  const failures: { platform: Platform; error: string }[] = []
  const builds: {
    platform: Platform; keywordCount: number; negativeKeywordCount: number
    adCount: number; status: string; warnings: string[]
  }[] = []

  for (const platform of body.platforms as Platform[]) {
    const share =
      body.platforms.length === 1 ? 1 : platform === "meta" ? metaShare : 1 - metaShare
    const dailyBudget = Math.round((body.monthlyBudget * share) / 30)
    if (dailyBudget <= 0) continue

    const accountId =
      platform === "google"
        ? dealer.platform?.googleCustomerId
        : dealer.platform?.metaAdAccountId

    if (!accountId) {
      failures.push({ platform, error: "No ad account id on the dealer record." })
      continue
    }

    const input: CreateCampaignInput = {
      dealerCode: dealer.code,
      dealerName: dealer.name,
      brand: dealer.brands[0] ?? "",
      model: body.model,
      objective: body.objective,
      dailyBudget,
      city: dealer.city,
      radiusKm: body.radiusKm,
      startDate: body.startDate,
      endDate: body.endDate,
      landingPageUrl: dealer.landingPageUrl ?? "",
      virtualNumber: dealer.virtualNumber,
      headline: body.headline,
      description: body.description,
      offer: body.offer,
      goLive: body.goLive,
      metaPageId: dealer.platform?.metaPageId ?? null,
    }

    const provider = getProvider(platform)
    const result = await provider.createCampaign(accountId, input)

    if (!result.ok || !result.data) {
      failures.push({ platform, error: result.error ?? "Unknown provider error." })
      continue
    }

    builds.push({
      platform,
      keywordCount: result.data.keywordCount,
      negativeKeywordCount: result.data.negativeKeywordCount,
      adCount: result.data.adCount,
      status: result.data.status,
      warnings: result.data.warnings,
    })

    created.push(
      await store.createCampaign({
        dealerId: dealer.id,
        platform,
        platformCampaignId: result.data.platformCampaignId,
        name: result.data.name,
        objective: body.objective,
        dailyBudget,
        // Reflect what the provider actually did, not what was asked for.
        status: result.data.status,
        provenance: result.provenance,
        createdBy: actorId(await currentUser()),
      }),
    )
  }

  // Warnings mean the campaign exists but something under it did not build.
  const warnings = builds.flatMap((b) =>
    b.warnings.map((w) => ({ platform: b.platform, warning: w })),
  )
  const status = created.length === 0 ? 502 : failures.length > 0 ? 207 : 201
  return NextResponse.json({ created, failures, warnings, builds }, { status })
}
