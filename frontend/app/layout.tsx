import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../lib/auth"

export const metadata: Metadata = {
  title: "AI Ad Manager",
  description: "Ad management built for Indian car dealerships",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <body>
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  )
}
