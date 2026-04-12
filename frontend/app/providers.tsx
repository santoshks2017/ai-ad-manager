"use client"

import type { ReactNode } from "react"
import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

interface ProvidersProps {
  children: ReactNode
  session: Session | null
}

export function Providers({ children, session }: ProvidersProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
