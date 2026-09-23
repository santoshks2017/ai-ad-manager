import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Route protection.
 *
 * This is a shallow check: it only asks whether a session cookie is present,
 * because middleware runs on the Edge runtime where firebase-admin cannot.
 * The cookie is actually verified in server components and route handlers via
 * `currentUser()` — that is where the authorisation decision matters, and a
 * forged cookie fails there.
 */
const PUBLIC_PATHS = [
  "/signin",
  "/api/auth/session",
  // Showrooms open this from a WhatsApp link, so it cannot require a session.
  // It is protected by a signed token instead and exposes only that
  // showroom's name, city and remaining setup steps.
  "/onboard/",
  // Machine-to-machine, authenticated by its own shared secret.
  "/api/optimisations/scan",
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Meta and Google redirect back here after a showroom authorises us; the
  // callback carries its own signed state parameter.
  if (pathname.startsWith("/api/integrations/")) return NextResponse.next()

  const hasSession = Boolean(req.cookies.get("console_session")?.value)
  if (hasSession) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = "/signin"
  url.search = `?next=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
}
