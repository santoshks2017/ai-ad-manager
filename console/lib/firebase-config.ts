import type { FirebaseClientConfig } from "./firebase-client"

/**
 * Firebase browser config, read at request time on the server.
 *
 * Returns null when unset, so callers can render an explicit "not configured"
 * state instead of failing with an opaque Firebase error.
 */
export function firebaseClientConfig(): FirebaseClientConfig | null {
  const apiKey = process.env.FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const authDomain =
    process.env.FIREBASE_AUTH_DOMAIN ??
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    (projectId ? `${projectId}.firebaseapp.com` : undefined)

  if (!apiKey || !authDomain || !projectId) return null
  return { apiKey, authDomain, projectId }
}
