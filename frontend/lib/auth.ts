import GoogleProvider from "next-auth/providers/google"
import { type NextAuthOptions } from "next-auth"
import jwt from "jsonwebtoken"

declare module "next-auth" {
  interface Session {
    backendToken?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Sign custom backend token with shared secret
        const backendToken = jwt.sign(
          {
            email: user.email,
            name: user.name,
            sub: user.id,
          },
          process.env.NEXTAUTH_SECRET || "my-super-secret-nextauth-token-jwe-signing-key",
          { expiresIn: "7d" }
        )
        token.backendToken = backendToken
      }
      return token
    },
    async session({ session, token }) {
      session.backendToken = token.backendToken as string
      return session
    },
  },
}
