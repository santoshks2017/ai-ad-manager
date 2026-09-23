import { NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/store"
import { currentUser } from "@/lib/session"
import { canOperate } from "@/lib/session"

const Body = z.object({
  code: z.string().min(3).max(12).regex(/^[A-Z0-9]+$/, "Use capitals and digits only."),
  name: z.string().min(2).max(120),
  city: z.string().min(2).max(60),
  state: z.string().min(2).max(60),
  brands: z.array(z.string().min(1)).min(1),
  models: z.array(z.string().min(1)).min(1),
  monthlyBudget: z.number().min(0).max(50_000_000),
  committedCpl: z.number().min(0).max(100_000).nullable().default(null),
  virtualNumber: z.string().max(40).nullable().default(null),
  landingPageUrl: z.string().max(400).nullable().default(null),
  lmsAccountRef: z.string().max(80).nullable().default(null),
  ownership: z.enum(["agency_owned", "dealer_linked"]).default("dealer_linked"),
  billing: z.enum(["agency_billed", "dealer_billed"]).default("agency_billed"),
})

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  if (!canOperate(user.role)) {
    return NextResponse.json(
      { error: "Only account managers and admins can add showrooms." },
      { status: 403 },
    )
  }

  let body
  try {
    body = Body.parse(await req.json())
  } catch (err) {
    const issue = (err as { issues?: { message: string }[] }).issues?.[0]?.message
    return NextResponse.json(
      { error: issue ?? "Check the showroom details." },
      { status: 400 },
    )
  }

  const store = await getStore()
  const existing = await store.listDealers()
  if (existing.some((d) => d.code.toUpperCase() === body.code.toUpperCase())) {
    return NextResponse.json(
      { error: `A showroom already uses the code ${body.code}. Codes appear in platform campaign names, so they have to be unique.` },
      { status: 409 },
    )
  }

  const account = {
    ownership: body.ownership,
    billing: body.billing,
    // Nothing granted yet either way: a dealer-linked showroom has not been
    // asked, and an agency-owned one has nothing to grant.
    grant: "not_requested" as const,
    lastVerifiedAt: null,
  }

  const dealer = await store.createDealer({
    code: body.code.toUpperCase(),
    name: body.name,
    city: body.city,
    state: body.state,
    brands: body.brands,
    models: body.models,
    monthlyBudget: body.monthlyBudget,
    // Never inferred from a quote — committing a CPL is a deliberate act.
    committedCpl: body.committedCpl,
    virtualNumber: body.virtualNumber,
    landingPageUrl: body.landingPageUrl,
    lmsAccountRef: body.lmsAccountRef,
    status: "pending_connection",
    ownerId: user.email,
    platform: {
      googleCustomerId: null,
      googleState: "not_started",
      googleVerified: false,
      google: account,
      metaBusinessId: null,
      metaPageId: null,
      metaAdAccountId: null,
      metaState: "not_started",
      metaVerified: false,
      meta: account,
      googleBusinessProfileLinked: false,
      googleBusinessAccountEmail: null,
      servicesAgreementSigned: false,
      legalDocsCollected: false,
    },
  })

  return NextResponse.json({ dealer }, { status: 201 })
}
