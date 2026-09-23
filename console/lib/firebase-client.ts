"use client"

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"

/**
 * Browser-side Firebase.
 *
 * These values are publishable by design — the API key identifies the project,
 * it does not authorise anything. Access is controlled by Firebase Auth and by
 * the server verifying the session cookie, not by keeping this secret.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

export function clientAuth(): Auth {
  const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(config)
  return getAuth(app)
}

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId)
}
