/**
 * Session handling.
 *
 * Firebase Auth issues a short-lived ID token in the browser; this exchanges it
 * for a long-lived httpOnly session cookie that server code can verify. The ID
 * token never persists client-side, so an XSS cannot lift a usable credential.
 *
 * Password hashing, rate limiting and token signing are Firebase's problem
 * rather than ours — rolling those by hand is how auth bugs get written.
 *
 * Verification happens in server components and route handlers, not in
 * middleware: middleware runs on the Edge runtime where firebase-admin cannot,
 * so it does a shallow cookie-presence check and the real check happens where
 * the decision actually matters.
 */

import { cookies } from "next/headers"
import type { Role, User } from "./types"

export const SESSION_COOKIE = "console_session"
const SESSION_DAYS = 5

export interface SessionUser {
  uid: string
  email: string
  name: string
  role: Role
}

async function adminAuth() {
  const admin = await import("firebase-admin")
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
  const apps = admin.getApps?.() ?? []
  const app = apps.length ? apps[0] : admin.initializeApp({ projectId })
  const { getAuth } = await import("firebase-admin/auth")
  return getAuth(app)
}

/** Exchange a Firebase ID token for a session cookie. Returns its value. */
export async function createSessionCookie(idToken: string): Promise<string> {
  const auth = await adminAuth()
  return auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DAYS * 24 * 60 * 60 * 1000,
  })
}

/**
 * The signed-in user, or null.
 *
 * Roles live on the user record in Firestore rather than in the token, so a
 * role change takes effect on the next request instead of waiting for the
 * token to refresh.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const cookie = jar.get(SESSION_COOKIE)?.value
  if (!cookie) return null

  try {
    const auth = await adminAuth()
    // checkRevoked so a disabled account loses access immediately rather than
    // when its cookie happens to expire.
    const decoded = await auth.verifySessionCookie(cookie, true)

    const { getStore } = await import("./store")
    const store = await getStore()
    const users = await store.listUsers()
    // Prefer the record keyed by the real Firebase uid. Sample data seeds
    // placeholder users with the same emails, so matching on email alone can
    // pick the wrong record and hand back the wrong role.
    const email = (decoded.email ?? "").toLowerCase()
    const record =
      users.find((u) => u.id === decoded.uid) ??
      users.find((u) => u.email.toLowerCase() === email)

    if (record && !record.active) return null

    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      name: record?.name ?? decoded.name ?? decoded.email ?? "Unknown",
      // Unknown signed-in accounts get the least privilege, not the most.
      role: record?.role ?? "sales",
    }
  } catch {
    return null
  }
}

/** For routes that must not run anonymously. Throws rather than returning null. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) throw new Error("Not signed in.")
  return user
}

/** The actor id to stamp on records. Falls back to the email for traceability. */
export function actorId(user: SessionUser | null): string {
  return user?.email ?? "unknown"
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  account_manager: "Account manager",
  sales: "Sales",
}

/** Whether a role may approve and apply optimisations or activate orders. */
export function canOperate(role: Role): boolean {
  return role === "admin" || role === "account_manager"
}
