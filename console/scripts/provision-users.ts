/**
 * Provision console sign-ins.
 *
 * Creates Firebase Auth users and their matching role records, including the
 * reviewer account Meta needs in order to test the app.
 *
 * Run:  npx tsx scripts/provision-users.ts
 *
 * Passwords are generated here and printed once. They are not stored in the
 * repo and never leave this machine.
 */

import { randomBytes } from "node:crypto"

const PROJECT = process.env.FIREBASE_PROJECT_ID ?? "aiad-manager"

/**
 * Meta's reviewer needs a working login to follow the onboarding flow. It gets
 * account_manager rather than admin: enough to see and operate the flow under
 * review, not enough to change team access.
 */
const TEAM: { email: string; name: string; role: "admin" | "account_manager" | "sales" }[] = [
  { email: "santosh.sharma@girnarsoft.com", name: "Santosh Sharma", role: "admin" },
  { email: "priya.nair@girnarsoft.com", name: "Priya Nair", role: "account_manager" },
  { email: "rahul.verma@girnarsoft.com", name: "Rahul Verma", role: "account_manager" },
  { email: "aditya.rao@girnarsoft.com", name: "Aditya Rao", role: "sales" },
  { email: "meta.reviewer@girnarsoft.com", name: "Meta App Reviewer", role: "account_manager" },
]

function password(): string {
  // Readable enough to type into a review form, long enough to be fine.
  return randomBytes(12).toString("base64url").slice(0, 16)
}

async function main() {
  const admin = await import("firebase-admin")
  const apps = admin.getApps?.() ?? []
  const app = apps.length ? apps[0] : admin.initializeApp({ projectId: PROJECT })
  const { getAuth } = await import("firebase-admin/auth")
  const { getFirestore } = await import("firebase-admin/firestore")
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log(`\nProvisioning sign-ins on ${PROJECT}\n${"─".repeat(72)}`)
  const issued: { email: string; password: string; role: string }[] = []

  for (const member of TEAM) {
    const pw = password()
    let uid: string

    try {
      const existing = await auth.getUserByEmail(member.email)
      uid = existing.uid
      await auth.updateUser(uid, { password: pw, displayName: member.name })
      console.log(`  reset   ${member.email.padEnd(38)} ${member.role}`)
    } catch {
      const created = await auth.createUser({
        email: member.email,
        password: pw,
        displayName: member.name,
        emailVerified: true,
      })
      uid = created.uid
      console.log(`  created ${member.email.padEnd(38)} ${member.role}`)
    }

    // The role lives in Firestore, not the token, so changing it takes effect
    // on the next request rather than the next token refresh.
    await db.collection("users").doc(uid).set(
      {
        id: uid,
        email: member.email,
        name: member.name,
        role: member.role,
        active: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    )

    issued.push({ email: member.email, password: pw, role: member.role })
  }

  console.log(`${"─".repeat(72)}\n`)
  console.log("Passwords — shown once, not stored anywhere:\n")
  for (const i of issued) {
    console.log(`  ${i.email.padEnd(38)} ${i.password}`)
  }
  console.log(
    "\nGive the meta.reviewer credentials to Meta in the App Review submission,\n" +
      "in the 'Instructions for reviewer' field. Everyone else should change\n" +
      "their password after first sign-in.\n",
  )
  process.exit(0)
}

main().catch((err) => {
  console.error("\nFailed:", err.message)
  console.error(
    "\nThis needs credentials that can administer the Firebase project. Run:\n" +
      "  gcloud auth application-default login\n",
  )
  process.exit(1)
})
