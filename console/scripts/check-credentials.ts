/**
 * Verify ad platform credentials against the live APIs.
 *
 * The provider code has never run against a real endpoint. This is the first
 * thing to run once credentials exist — it makes one cheap read per platform
 * and reports precisely which part is wrong, rather than leaving a failure to
 * surface mid-campaign-build.
 *
 * Run:  npx tsx scripts/check-credentials.ts
 */

const GOOGLE_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v21"
const META_VERSION = process.env.META_API_VERSION ?? "v21.0"

type Check = { name: string; ok: boolean; detail: string }

async function googleAccessToken(): Promise<string | null> {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refresh = process.env.GOOGLE_ADS_REFRESH_TOKEN
  if (!id || !secret || !refresh) return null

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id, client_secret: secret,
      refresh_token: refresh, grant_type: "refresh_token",
    }),
  })
  if (!res.ok) return null
  return ((await res.json()) as { access_token?: string }).access_token ?? null
}

async function checkGoogle(): Promise<Check[]> {
  const out: Check[] = []
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

  if (!devToken) {
    out.push({ name: "Google developer token", ok: false, detail: "GOOGLE_ADS_DEVELOPER_TOKEN is not set." })
  }
  if (!mcc) {
    out.push({ name: "Google MCC id", ok: false, detail: "GOOGLE_ADS_LOGIN_CUSTOMER_ID is not set." })
  }

  const token = await googleAccessToken()
  if (!token) {
    out.push({
      name: "Google OAuth", ok: false,
      detail: "Could not exchange the refresh token. Run scripts/google-oauth.ts.",
    })
    return out
  }
  out.push({ name: "Google OAuth", ok: true, detail: "Refresh token exchanged successfully." })

  if (!devToken || !mcc) return out

  // listAccessibleCustomers is the cheapest call that proves the whole chain:
  // token, developer token and MCC access.
  const res = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": devToken,
        "login-customer-id": mcc.replace(/-/g, ""),
      },
    },
  )
  const body = await res.text()

  out.push(
    res.ok
      ? {
          name: "Google Ads API",
          ok: true,
          detail: `Reachable. Accessible customers: ${
            (JSON.parse(body).resourceNames ?? []).length
          }.`,
        }
      : {
          name: "Google Ads API",
          ok: false,
          detail: `HTTP ${res.status}. ${body.slice(0, 300)}`,
        },
  )
  return out
}

async function checkMeta(): Promise<Check[]> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    return [{ name: "Meta access token", ok: false, detail: "META_ACCESS_TOKEN is not set." }]
  }

  const out: Check[] = []

  const me = await fetch(
    `https://graph.facebook.com/${META_VERSION}/me?fields=id,name&access_token=${token}`,
  )
  const meBody = await me.text()
  out.push(
    me.ok
      ? { name: "Meta token", ok: true, detail: `Valid. ${meBody.slice(0, 120)}` }
      : { name: "Meta token", ok: false, detail: `HTTP ${me.status}. ${meBody.slice(0, 300)}` },
  )
  if (!me.ok) return out

  const accounts = await fetch(
    `https://graph.facebook.com/${META_VERSION}/me/adaccounts?fields=id,name,account_status&limit=5&access_token=${token}`,
  )
  const accBody = await accounts.text()
  out.push(
    accounts.ok
      ? {
          name: "Meta ad accounts",
          ok: true,
          detail: `Reachable. ${(JSON.parse(accBody).data ?? []).length} account(s) visible.`,
        }
      : {
          name: "Meta ad accounts",
          ok: false,
          detail: `HTTP ${accounts.status}. ${accBody.slice(0, 300)}`,
        },
  )
  return out
}

async function main() {
  console.log("\nChecking ad platform credentials\n" + "─".repeat(64))
  const checks = [...(await checkGoogle()), ...(await checkMeta())]

  for (const c of checks) {
    console.log(`${c.ok ? "  ok  " : " FAIL "} ${c.name.padEnd(22)} ${c.detail}`)
  }

  const failed = checks.filter((c) => !c.ok)
  console.log("─".repeat(64))
  console.log(
    failed.length === 0
      ? "All checks passed. The live providers can be switched on.\n"
      : `${failed.length} check(s) failed. The console will keep using the simulator.\n`,
  )
  process.exit(failed.length === 0 ? 0 : 1)
}

main()
