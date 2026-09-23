import { NextResponse } from "next/server"
import { z } from "zod"
import { SESSION_COOKIE, createSessionCookie } from "@/lib/session"

const Body = z.object({ idToken: z.string().min(20) })

export async function POST(req: Request) {
  let body
  try {
    body = Body.parse(await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  try {
    const cookie = await createSessionCookie(body.idToken)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 24 * 60 * 60,
    })
    return res
  } catch (err) {
    return NextResponse.json(
      { error: `Could not start a session: ${(err as Error).message}` },
      { status: 401 },
    )
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 })
  return res
}
