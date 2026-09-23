import { NextResponse } from "next/server"
import { META_SCOPES, exchangeAndDiscover, verifyState } from "@/lib/meta-oauth"
import { onboardToken } from "@/lib/onboard-link"
import { getStore } from "@/lib/store"
import { publicOrigin } from "@/lib/origin"

/**
 * Where Meta sends the showroom back after they authorise us.
 *
 * Records what they granted and moves the grant to active. The showroom's own
 * business, ad account and Page ids are discovered from the token rather than
 * typed in by anyone, which removes a whole class of "wrong account connected"
 * mistake.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  // Cloud Run forwards to 0.0.0.0:8080, so the request URL is not the public one.
  const origin = await publicOrigin(url.origin)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state") ?? ""
  const declined = url.searchParams.get("error")

  const verified = verifyState(state)
  if (!verified) {
    return NextResponse.json(
      { error: "This link did not come from a session we started." },
      { status: 400 },
    )
  }

  const store = await getStore()
  const dealer = await store.getDealer(verified.dealerId)
  if (!dealer) return NextResponse.json({ error: "Not found." }, { status: 404 })

  const back = (status: string) =>
    NextResponse.redirect(
      `${origin}/onboard/${onboardToken(dealer.id)}?meta=${status}`,
    )

  if (declined || !code) return back("declined")

  const result = await exchangeAndDiscover(
    code,
    `${origin}/api/integrations/meta/callback`,
  )
  if (!result.ok) return back("failed")

  const g = result.grant
  await store.updateDealer(dealer.id, {
    platform: {
      ...dealer.platform,
      metaBusinessId: g.businessId,
      metaAdAccountId: g.adAccountId,
      metaPageId: g.pageId,
      metaState: g.adAccountId && g.pageId ? "ready" : "in_progress",
      metaVerified: Boolean(g.businessId),
      meta: {
        ...dealer.platform.meta,
        ownership: "dealer_linked",
        grant: "active",
        lastVerifiedAt: new Date().toISOString(),
      },
    },
  })

  // The token lives in its own collection so ordinary reads of a showroom never
  // carry a live credential around the application.
  await store.saveToken({
    dealerId: dealer.id,
    platform: "meta",
    accessToken: g.accessToken,
    expiresAt: g.expiresInDays
      ? new Date(Date.now() + g.expiresInDays * 86_400_000).toISOString()
      : null,
    scopes: [...META_SCOPES],
    grantedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
  })

  return back(g.adAccountId && g.pageId ? "connected" : "partial")
}
