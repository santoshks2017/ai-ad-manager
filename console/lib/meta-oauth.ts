/**
 * Facebook Login for showroom onboarding.
 *
 * This is the flow Meta's App Review actually reviews: a separate business
 * grants our app permission to manage their ad account. An app that only ever
 * touches its own account gets rejected, so this path has to be real and
 * followable by a reviewer.
 *
 * The showroom keeps ownership of everything. We receive delegated access,
 * which they can revoke at any time from their own Business Settings.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

const API_VERSION = process.env.META_API_VERSION ?? "v21.0"

/**
 * Scopes requested, and why each is needed. App Review asks for a
 * justification per permission, so keeping the set minimal matters.
 */
export const META_SCOPES = [
  "ads_management",      // create and manage campaigns on the showroom's account
  "ads_read",            // read delivery to report performance back to them
  "business_management", // discover which businesses and ad accounts they granted
] as const

function secret(): string {
  return process.env.ONBOARD_LINK_SECRET ?? "dev-only-onboard-secret"
}

/**
 * Signed state parameter.
 *
 * Carries which showroom is connecting and proves the callback came from a
 * flow we started. Without this, anyone could hit the callback and attach
 * their own token to someone else's showroom record.
 */
export function signState(dealerId: string, nonce: string): string {
  const payload = `${dealerId}.${nonce}`
  const sig = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 16)
  return `${payload}.${sig}`
}

export function verifyState(state: string): { dealerId: string } | null {
  const parts = state.split(".")
  if (parts.length !== 3) return null
  const [dealerId, nonce, sig] = parts
  const expected = createHmac("sha256", secret())
    .update(`${dealerId}.${nonce}`)
    .digest("hex")
    .slice(0, 16)
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return { dealerId }
}

export function authorizeUrl(dealerId: string, redirectUri: string): string | null {
  const appId = process.env.META_APP_ID
  if (!appId) return null

  const nonce = Math.random().toString(36).slice(2, 10)
  return (
    `https://www.facebook.com/${API_VERSION}/dialog/oauth?` +
    new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state: signState(dealerId, nonce),
      scope: META_SCOPES.join(","),
      response_type: "code",
    })
  )
}

export interface MetaGrant {
  accessToken: string
  expiresInDays: number | null
  businessId: string | null
  adAccountId: string | null
  pageId: string | null
  businessName: string | null
}

/** Exchange the code, then discover what the showroom actually granted us. */
export async function exchangeAndDiscover(
  code: string,
  redirectUri: string,
): Promise<{ ok: true; grant: MetaGrant } | { ok: false; error: string }> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return { ok: false, error: "META_APP_ID and META_APP_SECRET are not configured." }
  }

  const tokenRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }),
  )
  const tokenBody = (await tokenRes.json()) as {
    access_token?: string
    error?: { message?: string }
  }
  if (!tokenRes.ok || !tokenBody.access_token) {
    return { ok: false, error: tokenBody.error?.message ?? "Token exchange failed." }
  }

  // Short-lived tokens last an hour or two, which is useless for a background
  // job. Trade up for the ~60-day one immediately.
  const longRes = await fetch(
    `https://graph.facebook.com/${API_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokenBody.access_token,
      }),
  )
  const longBody = (await longRes.json()) as {
    access_token?: string
    expires_in?: number
  }
  const accessToken = longBody.access_token ?? tokenBody.access_token
  const expiresInDays = longBody.expires_in
    ? Math.round(longBody.expires_in / 86_400)
    : null

  const get = async <T,>(path: string): Promise<T | null> => {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${path}${path.includes("?") ? "&" : "?"}access_token=${accessToken}`,
    )
    return res.ok ? ((await res.json()) as T) : null
  }

  const businesses = await get<{ data?: { id: string; name: string }[] }>(
    "me/businesses?fields=id,name&limit=5",
  )
  const adAccounts = await get<{ data?: { id: string; name: string }[] }>(
    "me/adaccounts?fields=id,name,account_status&limit=5",
  )
  const pages = await get<{ data?: { id: string; name: string }[] }>(
    "me/accounts?fields=id,name&limit=5",
  )

  return {
    ok: true,
    grant: {
      accessToken,
      expiresInDays,
      businessId: businesses?.data?.[0]?.id ?? null,
      businessName: businesses?.data?.[0]?.name ?? null,
      adAccountId: adAccounts?.data?.[0]?.id ?? null,
      pageId: pages?.data?.[0]?.id ?? null,
    },
  }
}
