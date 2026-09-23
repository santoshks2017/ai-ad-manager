/**
 * Mint a Google Ads refresh token.
 *
 * Google Ads API calls are made as a user, so the console needs a refresh token
 * belonging to an account with access to the MCC. That token is obtained once,
 * by a human signing in — it cannot be generated from a service account.
 *
 * Run:  npx tsx scripts/google-oauth.ts
 *
 * Needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in the
 * environment, from a Desktop-app OAuth client in the Cloud console.
 *
 * Nothing is written to disk. The token is printed once; put it straight into
 * the deployment.
 */

import { createServer } from "node:http"
import { spawn } from "node:child_process"

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const PORT = 8787
const REDIRECT = `http://localhost:${PORT}/callback`
const SCOPE = "https://www.googleapis.com/auth/adwords"

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "\nMissing OAuth client credentials.\n\n" +
      "  export GOOGLE_OAUTH_CLIENT_ID='...apps.googleusercontent.com'\n" +
      "  export GOOGLE_OAUTH_CLIENT_SECRET='...'\n\n" +
      "Create these in the Cloud console under APIs & Services > Credentials,\n" +
      "as an OAuth client of type 'Desktop app', on project aiad-manager.\n",
  )
  process.exit(1)
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // Offline plus consent is what actually returns a refresh token; without
    // prompt=consent Google omits it on repeat authorisations.
    access_type: "offline",
    prompt: "consent",
  })

async function exchange(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  })
  const data = (await res.json()) as { refresh_token?: string; error_description?: string }
  if (!res.ok || !data.refresh_token) {
    throw new Error(
      data.error_description ??
        "No refresh token returned. If you have authorised this client before, " +
          "revoke it at myaccount.google.com/permissions and run this again.",
    )
  }
  return data.refresh_token
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)
  if (url.pathname !== "/callback") {
    res.writeHead(404).end()
    return
  }

  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" })
    res.end(`Authorisation failed: ${error ?? "no code returned"}`)
    server.close()
    process.exit(1)
  }

  try {
    const refreshToken = await exchange(code)
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end("<h2>Done. The refresh token is in your terminal.</h2>")

    console.log("\n" + "─".repeat(64))
    console.log("GOOGLE_ADS_REFRESH_TOKEN=" + refreshToken)
    console.log("─".repeat(64))
    console.log(
      "\nThis is a long-lived credential that can spend money. Do not commit it,\n" +
        "do not paste it into a chat, and set it on the service directly.\n",
    )
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" })
    res.end(String(err))
    console.error("\n" + String(err) + "\n")
  } finally {
    server.close()
    setTimeout(() => process.exit(0), 100)
  }
})

server.listen(PORT, () => {
  console.log(`\nListening on ${REDIRECT}\nOpening your browser…\n`)
  console.log(`If it does not open, go to:\n\n${authUrl}\n`)
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  spawn(opener, [authUrl], { stdio: "ignore", detached: true }).unref()
})
