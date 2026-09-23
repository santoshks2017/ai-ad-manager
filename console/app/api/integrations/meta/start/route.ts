import { NextResponse } from "next/server"
import { authorizeUrl } from "@/lib/meta-oauth"
import { verifyOnboardToken } from "@/lib/onboard-link"
import { getStore } from "@/lib/store"
import { publicOrigin } from "@/lib/origin"

/**
 * Begin Facebook Login for a showroom.
 *
 * Reached from the showroom's own onboarding link, so it authenticates with
 * the signed onboarding token rather than a staff session — the person
 * clicking is the dealer, not us.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  // Cloud Run forwards to 0.0.0.0:8080, so the request URL is not the public one.
  const origin = await publicOrigin(url.origin)
  const token = url.searchParams.get("token") ?? ""

  const dealerId = verifyOnboardToken(token)
  if (!dealerId) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 })
  }

  const store = await getStore()
  const dealer = await store.getDealer(dealerId)
  if (!dealer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const redirectUri = `${origin}/api/integrations/meta/callback`
  const authUrl = authorizeUrl(dealerId, redirectUri)

  if (!authUrl) {
    return NextResponse.redirect(
      `${origin}/onboard/${token}?meta=unconfigured`,
    )
  }
  return NextResponse.redirect(authUrl)
}
