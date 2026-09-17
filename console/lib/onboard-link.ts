import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Signed onboarding links.
 *
 * The dealer onboarding page sits outside the staff passphrase, because dealers
 * open it from WhatsApp. A bare `/onboard/<dealerId>` would therefore be
 * enumerable — walk the ids and you can read every dealer's name, city and
 * setup state. Not high-sensitivity, but it is still our client list.
 *
 * So the path carries an HMAC of the dealer id. Nothing extra to store, the
 * link stays stable, and guessing one requires the secret.
 */

function secret(): string {
  // Falls back to a dev-only constant so local work needs no setup; production
  // sets ONBOARD_LINK_SECRET. Deployment warns if it is missing.
  return process.env.ONBOARD_LINK_SECRET ?? "dev-only-onboard-secret"
}

function sign(dealerId: string): string {
  return createHmac("sha256", secret()).update(dealerId).digest("hex").slice(0, 16)
}

export function onboardToken(dealerId: string): string {
  return `${dealerId}.${sign(dealerId)}`
}

/** Returns the dealer id when the token is authentic, otherwise null. */
export function verifyOnboardToken(token: string): string | null {
  const idx = token.lastIndexOf(".")
  if (idx <= 0) return null

  const dealerId = token.slice(0, idx)
  const provided = token.slice(idx + 1)
  const expected = sign(dealerId)

  if (provided.length !== expected.length) return null
  // Constant-time compare so the signature cannot be recovered by timing.
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null

  return dealerId
}
