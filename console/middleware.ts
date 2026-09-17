import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Access gate.
 *
 * Cloud Run serves publicly by default. Even though everything in the console
 * today is generated sample data, a dealer book on an open URL is not a habit
 * worth forming — real figures land in the same screens later. So the deployed
 * console sits behind a shared passphrase until proper Firebase Auth with
 * domain restriction replaces it.
 *
 * When ACCESS_PASSWORD is unset (local development) the gate is open.
 */
export function middleware(req: NextRequest) {
  // The scheduled scan is machine-to-machine and carries its own shared
  // secret, so it does not go through the passphrase gate.
  if (req.nextUrl.pathname === "/api/optimisations/scan") {
    return NextResponse.next()
  }

  // The dealer onboarding page is opened by dealers from a WhatsApp link, so it
  // cannot sit behind the staff passphrase. It exposes only the dealer's own
  // name, city and remaining setup steps — no performance figures, no spend,
  // and no data about any other dealer.
  if (req.nextUrl.pathname.startsWith("/onboard/")) {
    return NextResponse.next()
  }

  const expected = process.env.ACCESS_PASSWORD
  if (!expected) return NextResponse.next()

  const cookie = req.cookies.get("console_access")?.value
  if (cookie === expected) return NextResponse.next()

  const auth = req.headers.get("authorization")
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6))
    const password = decoded.split(":")[1] ?? ""
    if (password === expected) {
      const res = NextResponse.next()
      res.cookies.set("console_access", expected, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      })
      return res
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Ad Manager console"' },
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
