"use client"

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"

/**
 * Browser-side Firebase.
 *
 * Config is passed in from the server rather than read from NEXT_PUBLIC_*
 * variables. Those are inlined at build time, and this image is built by Cloud
 * Build without them — the runtime `--set-env-vars` arrive too late, so the
 * client silently got `undefined` and sign-in was dead in production while
 * looking fine locally.
 *
 * Reading it at request time also means rotating the key or pointing at another
 * Firebase project needs no rebuild.
 *
 * These values are publishable by design: the API key identifies the project,
 * it does not authorise anything. Access is enforced by Firebase Auth and by
 * the server verifying the session cookie.
 */
export interface FirebaseClientConfig {
  apiKey: string
  authDomain: string
  projectId: string
}

export function clientAuth(config: FirebaseClientConfig): Auth {
  const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(config)
  return getAuth(app)
}

export function isConfigured(config: FirebaseClientConfig | null): config is FirebaseClientConfig {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId)
}
