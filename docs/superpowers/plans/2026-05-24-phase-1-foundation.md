# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the local database, wire NextAuth to PostgreSQL, implement Express auth middleware, and build Google Ads + Meta OAuth account connection flows.

**Architecture:** NextAuth uses a custom JWT encode/decode (HS256 via jsonwebtoken) so Express can verify the same token with a shared NEXTAUTH_SECRET. A `/api/auth/token` Next.js route exposes the raw JWT to client-side code. Express routes import `requireAuth` middleware that verifies the Bearer token and injects `req.user`.

**Tech Stack:** PostgreSQL (pg), NextAuth v4, jsonwebtoken, googleapis, axios, node-cron, vitest, supertest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/db/migrate.ts` | Runs schema.sql against local PG |
| Create | `backend/src/middleware/auth.ts` | Verifies JWT Bearer token, injects req.user |
| Create | `backend/src/services/token-store.ts` | AES-256 encrypt/decrypt for ad account tokens |
| Create | `backend/src/routes/integrations.ts` | Google Ads + Meta OAuth flows |
| Modify | `backend/src/routes/auth.ts` | Implement /api/auth/me + /api/auth/upsert-user |
| Modify | `backend/src/app.ts` | Register integrations router |
| Create | `backend/vitest.config.ts` | Vitest config for ESM |
| Create | `backend/src/test/helpers.ts` | Test DB pool + seed helpers |
| Modify | `frontend/lib/auth.ts` | Add jwt callbacks, signIn → PG upsert |
| Create | `frontend/app/api/auth/token/route.ts` | Expose raw JWT to client |
| Create | `frontend/middleware.ts` | Protect /dashboard/* routes |
| Modify | `frontend/lib/api.ts` | Add auth token fetching, all protected fetchers |
| Modify | `frontend/app/dashboard/settings/page.tsx` | Wire connect/disconnect buttons |

---

## Task 1: Create Local Database

**Files:**
- Create: `backend/src/db/migrate.ts`

- [ ] **Step 1: Create the database**

```bash
cd /Users/santoshsharma/Documents/Code/ai-ad-manager
psql -U postgres -c "CREATE DATABASE ai_ad_manager_dev;"
psql -U postgres -c "CREATE DATABASE ai_ad_manager_test;"
```

Expected: `CREATE DATABASE` (twice)

- [ ] **Step 2: Write the migration runner**

Create `backend/src/db/migrate.ts`:

```typescript
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import pkg from "pg"

const { Pool } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8")
  await pool.query(sql)
  console.log("Migration complete")
  await pool.end()
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
```

- [ ] **Step 3: Create backend .env**

Create `backend/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_ad_manager_dev
NEXTAUTH_SECRET=local-dev-secret-change-in-prod-32chars
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_ADS_DEVELOPER_TOKEN=your-google-ads-developer-token
GOOGLE_ADS_CLIENT_ID=your-google-ads-client-id
GOOGLE_ADS_CLIENT_SECRET=your-google-ads-client-secret
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
INTERNAL_SECRET=local-internal-secret
PORT=4000
```

- [ ] **Step 4: Create frontend .env.local**

Create `frontend/.env.local`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-change-in-prod-32chars
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
API_URL=http://localhost:4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_ad_manager_dev
INTERNAL_SECRET=local-internal-secret
```

- [ ] **Step 5: Run migration**

```bash
cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_ad_manager_dev npx tsx src/db/migrate.ts
```

Expected: `Migration complete`

- [ ] **Step 6: Verify tables**

```bash
psql -U postgres -d ai_ad_manager_dev -c "\dt"
```

Expected: 8 tables listed (dealerships, users, ad_accounts, campaigns, leads, budget_settings, reports, metrics_cache)

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/migrate.ts backend/.env.example frontend/.env.local.example
git commit -m "feat: add DB migration runner and env templates"
```

---

## Task 2: Backend Testing Infrastructure

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/src/test/helpers.ts`

- [ ] **Step 1: Install test dependencies**

```bash
cd backend
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

Expected: packages added to devDependencies

- [ ] **Step 2: Create vitest config**

Create `backend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
})
```

- [ ] **Step 3: Create test setup**

Create `backend/src/test/setup.ts`:

```typescript
import { afterAll, beforeAll } from "vitest"
import pkg from "pg"

const { Pool } = pkg

export const testPool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test",
})

beforeAll(async () => {
  const { readFileSync } = await import("fs")
  const { join, dirname } = await import("path")
  const { fileURLToPath } = await import("url")
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const sql = readFileSync(join(__dirname, "../db/schema.sql"), "utf-8")
  await testPool.query(sql)
})

afterAll(async () => {
  await testPool.end()
})
```

Create `backend/src/test/helpers.ts`:

```typescript
import { testPool } from "./setup.js"

export async function clearTables() {
  await testPool.query(`
    TRUNCATE leads, metrics_cache, reports, budget_settings, campaigns, ad_accounts, users, dealerships CASCADE
  `)
}

export async function seedDealership(name = "Test Dealership") {
  const { rows } = await testPool.query(
    "INSERT INTO dealerships (name) VALUES ($1) RETURNING *",
    [name]
  )
  return rows[0]
}

export async function seedUser(dealershipId: string, email = "test@example.com") {
  const { rows } = await testPool.query(
    "INSERT INTO users (email, name, dealership_id, role) VALUES ($1, $2, $3, $4) RETURNING *",
    [email, "Test User", dealershipId, "owner"]
  )
  return rows[0]
}
```

- [ ] **Step 4: Add test scripts to package.json**

Modify `backend/package.json` — add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: Verify setup runs**

```bash
cd backend && npm test
```

Expected: `0 tests passed` (no test files yet — that's fine)

- [ ] **Step 6: Commit**

```bash
git add backend/vitest.config.ts backend/src/test/ backend/package.json
git commit -m "feat: add vitest testing infrastructure to backend"
```

---

## Task 3: Token Encryption Service

**Files:**
- Create: `backend/src/services/token-store.ts`
- Create: `backend/src/services/token-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/services/token-store.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { encryptToken, decryptToken } from "./token-store.js"

process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

describe("token-store", () => {
  it("encrypts a token to a non-readable string", () => {
    const encrypted = encryptToken("my-secret-access-token")
    expect(encrypted).not.toBe("my-secret-access-token")
    expect(encrypted).toContain(":")
  })

  it("decrypts back to the original value", () => {
    const original = "ya29.google-access-token-value"
    const encrypted = encryptToken(original)
    expect(decryptToken(encrypted)).toBe(original)
  })

  it("produces different ciphertext for the same input (random IV)", () => {
    const a = encryptToken("same-token")
    const b = encryptToken("same-token")
    expect(a).not.toBe(b)
    expect(decryptToken(a)).toBe("same-token")
    expect(decryptToken(b)).toBe("same-token")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test token-store
```

Expected: FAIL — `Cannot find module './token-store.js'`

- [ ] **Step 3: Implement the service**

Create `backend/src/services/token-store.ts`:

```typescript
import crypto from "crypto"

const ALGORITHM = "aes-256-cbc"
const IV_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)")
  return Buffer.from(hex, "hex")
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptToken(encrypted: string): string {
  const [ivHex, encryptedHex] = encrypted.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const encryptedBuffer = Buffer.from(encryptedHex, "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
  return decrypted.toString("utf8")
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test token-store
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/token-store.ts backend/src/services/token-store.test.ts
git commit -m "feat: add AES-256 token encryption service"
```

---

## Task 4: Backend Auth Middleware

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/middleware/auth.test.ts`

- [ ] **Step 1: Install jsonwebtoken**

```bash
cd backend && npm install jsonwebtoken && npm install -D @types/jsonwebtoken
```

- [ ] **Step 2: Write failing tests**

Create `backend/src/middleware/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import jwt from "jsonwebtoken"
import type { Request, Response, NextFunction } from "express"

const SECRET = "test-secret-32-chars-exactly-here"
process.env.NEXTAUTH_SECRET = SECRET

const { requireAuth } = await import("./auth.js")

function makeReqResNext(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  const next = vi.fn() as NextFunction
  return { req, res, next }
}

describe("requireAuth", () => {
  it("returns 401 when no Authorization header", () => {
    const { req, res, next } = makeReqResNext()
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("returns 401 for invalid token", () => {
    const { req, res, next } = makeReqResNext({ authorization: "Bearer bad-token" })
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it("injects user and calls next for valid token", () => {
    const payload = { userId: "user-123", dealershipId: "dealer-456", email: "test@x.com" }
    const token = jwt.sign(payload, SECRET, { algorithm: "HS256" })
    const { req, res, next } = makeReqResNext({ authorization: `Bearer ${token}` })
    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
    expect((req as any).user).toMatchObject(payload)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && npm test auth.test
```

Expected: FAIL — `Cannot find module './auth.js'`

- [ ] **Step 4: Implement auth middleware**

Create `backend/src/middleware/auth.ts`:

```typescript
import jwt from "jsonwebtoken"
import type { Request, Response, NextFunction } from "express"

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string
    dealershipId: string
    email: string
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any
    ;(req as AuthenticatedRequest).user = {
      userId: decoded.userId,
      dealershipId: decoded.dealershipId,
      email: decoded.email ?? decoded.sub ?? "",
    }
    next()
  } catch {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npm test auth.test
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/auth.ts backend/src/middleware/auth.test.ts
git commit -m "feat: add JWT Bearer token auth middleware"
```

---

## Task 5: Implement /api/auth/me and Upsert Endpoint

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Create: `backend/src/routes/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/routes/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../app.js"
import { clearTables, seedDealership, seedUser } from "../test/helpers.js"

const SECRET = "local-dev-secret-change-in-prod-32chars"
process.env.NEXTAUTH_SECRET = SECRET
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test"

function makeToken(userId: string, dealershipId: string) {
  return jwt.sign({ userId, dealershipId, email: "test@x.com" }, SECRET, { algorithm: "HS256" })
}

describe("GET /api/auth/me", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me")
    expect(res.status).toBe(401)
  })

  it("returns user + dealership for valid token", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe("test@example.com")
    expect(res.body.dealership.name).toBe("Test Dealership")
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test routes/auth
```

Expected: FAIL — returns `{ user: null, message: "Not implemented yet" }`

- [ ] **Step 3: Implement the route**

Replace `backend/src/routes/auth.ts`:

```typescript
import express from "express"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"

const router = express.Router()

router.get("/me", requireAuth, async (req, res) => {
  const { userId, dealershipId } = (req as AuthenticatedRequest).user
  try {
    const userResult = await pool.query(
      "SELECT id, email, name, role, dealership_id, created_at FROM users WHERE id = $1",
      [userId]
    )
    const dealershipResult = await pool.query(
      "SELECT id, name, created_at FROM dealerships WHERE id = $1",
      [dealershipId]
    )
    const adAccountsResult = await pool.query(
      "SELECT platform, account_name, connected_at FROM ad_accounts WHERE dealership_id = $1",
      [dealershipId]
    )

    if (!userResult.rows[0]) {
      res.status(404).json({ error: "User not found" })
      return
    }

    res.json({
      user: userResult.rows[0],
      dealership: dealershipResult.rows[0] ?? null,
      connectedAccounts: adAccountsResult.rows,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Internal server error" })
  }
})

export default router
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test routes/auth
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts backend/src/routes/auth.test.ts
git commit -m "feat: implement /api/auth/me with real DB query"
```

---

## Task 6: Configure NextAuth with Custom JWT + PG User Upsert

**Files:**
- Modify: `frontend/lib/auth.ts`
- Create: `frontend/app/api/auth/token/route.ts`
- Create: `frontend/middleware.ts`

- [ ] **Step 1: Install dependencies in frontend**

```bash
cd frontend && npm install jsonwebtoken pg && npm install -D @types/jsonwebtoken @types/pg
```

- [ ] **Step 2: Update NextAuth config**

Replace `frontend/lib/auth.ts`:

```typescript
import GoogleProvider from "next-auth/providers/google"
import { type NextAuthOptions } from "next-auth"
import jwt from "jsonwebtoken"
import pkg from "pg"

const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  jwt: {
    encode: async ({ secret, token }) => {
      return jwt.sign(token as object, secret as string, { algorithm: "HS256" })
    },
    decode: async ({ secret, token }) => {
      if (!token) return null
      return jwt.verify(token, secret as string) as any
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const email = (profile as any).email as string
        const name = ((profile as any).name as string) ?? email

        const existing = await pool.query(
          "SELECT id, dealership_id FROM users WHERE email = $1",
          [email]
        )

        if (existing.rows.length > 0) {
          token.userId = existing.rows[0].id
          token.dealershipId = existing.rows[0].dealership_id
        } else {
          const dealership = await pool.query(
            "INSERT INTO dealerships (name) VALUES ($1) RETURNING id",
            [`${name}'s Dealership`]
          )
          const user = await pool.query(
            "INSERT INTO users (email, name, dealership_id, role) VALUES ($1, $2, $3, 'owner') RETURNING id",
            [email, name, dealership.rows[0].id]
          )
          token.userId = user.rows[0].id
          token.dealershipId = dealership.rows[0].id
        }
      }
      return token
    },
    async session({ session, token }) {
      ;(session.user as any).userId = token.userId
      ;(session.user as any).dealershipId = token.dealershipId
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
```

- [ ] **Step 3: Create the raw JWT token endpoint**

Create `frontend/app/api/auth/token/route.ts`:

```typescript
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET!, raw: true })
  if (!token) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  return Response.json({ token })
}
```

- [ ] **Step 4: Create the frontend route guard middleware**

Create `frontend/middleware.ts`:

```typescript
import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  matcher: ["/dashboard/:path*"],
}
```

- [ ] **Step 5: Update frontend API client**

Replace `frontend/lib/api.ts`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

let cachedToken: string | null = null

async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const res = await fetch("/api/auth/token")
  if (!res.ok) throw new Error("Not authenticated")
  const { token } = await res.json()
  cachedToken = token
  // Clear cache after 50 minutes (tokens valid 1 hour)
  setTimeout(() => { cachedToken = null }, 50 * 60 * 1000)
  return token
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    me: () => apiFetch<{ user: any; dealership: any; connectedAccounts: any[] }>("/api/auth/me"),
  },
  dashboard: {
    metrics: (params?: string) => apiFetch<any>(`/api/dashboard/metrics${params ? `?${params}` : ""}`),
    topCampaign: (params?: string) => apiFetch<any>(`/api/dashboard/campaigns/top${params ? `?${params}` : ""}`),
  },
  campaigns: {
    templates: () => apiFetch<any[]>("/api/campaigns/templates"),
    list: (status?: string) => apiFetch<any[]>(`/api/campaigns${status ? `?status=${status}` : ""}`),
    create: (data: any) => apiFetch<any>("/api/campaigns/create", { method: "POST", body: JSON.stringify(data) }),
    pause: (id: string) => apiFetch<any>(`/api/campaigns/${id}/pause`, { method: "PATCH" }),
    resume: (id: string) => apiFetch<any>(`/api/campaigns/${id}/resume`, { method: "PATCH" }),
  },
  leads: {
    list: (params?: string) => apiFetch<any>(`/api/leads${params ? `?${params}` : ""}`),
    get: (id: string) => apiFetch<any>(`/api/leads/${id}`),
    update: (id: string, data: any) => apiFetch<any>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    count: () => apiFetch<{ count: number }>("/api/leads/count"),
    exportUrl: (params?: string) => `${API_URL}/api/leads/export${params ? `?${params}` : ""}`,
  },
  budget: {
    settings: () => apiFetch<any>("/api/budget/settings"),
    update: (data: any) => apiFetch<any>("/api/budget/settings", { method: "PUT", body: JSON.stringify(data) }),
    pauseAll: (confirmationToken: string) =>
      apiFetch<any>("/api/budget/pause-all", { method: "POST", body: JSON.stringify({ confirmationToken }) }),
  },
  reports: {
    list: () => apiFetch<any[]>("/api/reports"),
    get: (id: string) => apiFetch<any>(`/api/reports/${id}`),
    sendNow: () => apiFetch<any>("/api/reports/send-now", { method: "POST" }),
  },
  integrations: {
    google: {
      authUrl: () => apiFetch<{ url: string }>("/api/integrations/google/auth-url"),
      disconnect: () => apiFetch<void>("/api/integrations/google", { method: "DELETE" }),
    },
    meta: {
      authUrl: () => apiFetch<{ url: string }>("/api/integrations/meta/auth-url"),
      disconnect: () => apiFetch<void>("/api/integrations/meta", { method: "DELETE" }),
    },
  },
}
```

- [ ] **Step 6: Test login flow manually**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:3000, click "Sign in with Google", complete OAuth, verify you land on `/dashboard/settings`.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/auth.ts frontend/app/api/auth/token/ frontend/middleware.ts frontend/lib/api.ts
git commit -m "feat: configure NextAuth JWT for Express compatibility, add route guard"
```

---

## Task 7: Google Ads OAuth Flow

**Files:**
- Create: `backend/src/routes/integrations.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Install Google APIs**

```bash
cd backend && npm install googleapis axios
```

- [ ] **Step 2: Write failing tests**

Create `backend/src/routes/integrations.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../app.js"
import { clearTables, seedDealership, seedUser } from "../test/helpers.js"

const SECRET = "local-dev-secret-change-in-prod-32chars"
process.env.NEXTAUTH_SECRET = SECRET
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test"
process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
process.env.GOOGLE_ADS_CLIENT_ID = "google-client-id"
process.env.GOOGLE_ADS_CLIENT_SECRET = "google-client-secret"
process.env.META_APP_ID = "meta-app-id"
process.env.META_APP_SECRET = "meta-app-secret"

function makeToken(userId: string, dealershipId: string) {
  return jwt.sign({ userId, dealershipId }, SECRET, { algorithm: "HS256" })
}

describe("GET /api/integrations/google/auth-url", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/integrations/google/auth-url")
    expect(res.status).toBe(401)
  })

  it("returns a Google OAuth URL for authenticated user", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/integrations/google/auth-url")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.url).toContain("accounts.google.com")
  })
})

describe("DELETE /api/integrations/google", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("returns 200 even if no account was connected", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .delete("/api/integrations/google")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Run to verify failure**

```bash
cd backend && npm test integrations
```

Expected: FAIL — 404 routes not found

- [ ] **Step 4: Implement integrations router**

Create `backend/src/routes/integrations.ts`:

```typescript
import express from "express"
import { google } from "googleapis"
import axios from "axios"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { encryptToken, decryptToken } from "../services/token-store.js"

const router = express.Router()

const GOOGLE_REDIRECT = "http://localhost:4000/api/integrations/google/callback"
const META_REDIRECT = "http://localhost:4000/api/integrations/meta/callback"
const FRONTEND_SETTINGS = "http://localhost:3000/dashboard/settings"

function makeGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_REDIRECT
  )
}

// GET /api/integrations/google/auth-url
router.get("/google/auth-url", requireAuth, (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user
  const client = makeGoogleOAuth2Client()
  const url = client.generateAuthUrl({
    scope: ["https://www.googleapis.com/auth/adwords"],
    access_type: "offline",
    prompt: "consent",
    state: userId,
  })
  res.json({ url })
})

// GET /api/integrations/google/callback
router.get("/google/callback", async (req, res) => {
  const { code, state: userId } = req.query as { code: string; state: string }
  if (!code || !userId) {
    res.redirect(`${FRONTEND_SETTINGS}?error=missing_params`)
    return
  }

  try {
    const client = makeGoogleOAuth2Client()
    const { tokens } = await client.getToken(code)

    const userResult = await pool.query(
      "SELECT dealership_id FROM users WHERE id = $1",
      [userId]
    )
    if (!userResult.rows[0]) {
      res.redirect(`${FRONTEND_SETTINGS}?error=user_not_found`)
      return
    }
    const dealershipId = userResult.rows[0].dealership_id

    // Get Google Ads account info
    client.setCredentials(tokens)
    const customerService = google.ads({version: "v17", auth: client})
    let accountName = "Google Ads Account"
    let platformAccountId = "unknown"
    try {
      const response = await customerService.customers.listAccessibleCustomers({})
      platformAccountId = response.data.resourceNames?.[0]?.split("/")[1] ?? "unknown"
      accountName = `Google Ads (${platformAccountId})`
    } catch {
      // sandbox may not return real accounts — that's OK
    }

    await pool.query(
      `INSERT INTO ad_accounts (dealership_id, platform, platform_account_id, account_name, access_token, refresh_token, token_expires_at)
       VALUES ($1, 'google', $2, $3, $4, $5, $6)
       ON CONFLICT (dealership_id, platform) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           token_expires_at = EXCLUDED.token_expires_at,
           account_name = EXCLUDED.account_name`,
      [
        dealershipId,
        platformAccountId,
        accountName,
        encryptToken(tokens.access_token ?? ""),
        tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      ]
    )

    res.redirect(`${FRONTEND_SETTINGS}?connected=google`)
  } catch (err) {
    console.error("Google OAuth callback error:", err)
    res.redirect(`${FRONTEND_SETTINGS}?error=oauth_failed`)
  }
})

// DELETE /api/integrations/google
router.delete("/google", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  await pool.query(
    "DELETE FROM ad_accounts WHERE dealership_id = $1 AND platform = 'google'",
    [dealershipId]
  )
  res.json({ disconnected: true })
})

// GET /api/integrations/meta/auth-url
router.get("/meta/auth-url", requireAuth, (req, res) => {
  const { userId } = (req as AuthenticatedRequest).user
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: META_REDIRECT,
    scope: "ads_management,business_management",
    state: userId,
    response_type: "code",
  })
  const url = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`
  res.json({ url })
})

// GET /api/integrations/meta/callback
router.get("/meta/callback", async (req, res) => {
  const { code, state: userId } = req.query as { code: string; state: string }
  if (!code || !userId) {
    res.redirect(`${FRONTEND_SETTINGS}?error=missing_params`)
    return
  }

  try {
    const tokenRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: META_REDIRECT,
        code,
      },
    })

    const accessToken = tokenRes.data.access_token as string

    // Get Meta ad account info
    let accountName = "Meta Ads Account"
    let platformAccountId = "unknown"
    try {
      const meRes = await axios.get("https://graph.facebook.com/v19.0/me/adaccounts", {
        params: { access_token: accessToken, fields: "name,account_id" },
      })
      const firstAccount = meRes.data.data?.[0]
      if (firstAccount) {
        platformAccountId = firstAccount.account_id
        accountName = firstAccount.name
      }
    } catch {
      // sandbox may not return accounts
    }

    const userResult = await pool.query(
      "SELECT dealership_id FROM users WHERE id = $1",
      [userId]
    )
    const dealershipId = userResult.rows[0]?.dealership_id

    await pool.query(
      `INSERT INTO ad_accounts (dealership_id, platform, platform_account_id, account_name, access_token)
       VALUES ($1, 'meta', $2, $3, $4)
       ON CONFLICT (dealership_id, platform) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           account_name = EXCLUDED.account_name`,
      [dealershipId, platformAccountId, accountName, encryptToken(accessToken)]
    )

    res.redirect(`${FRONTEND_SETTINGS}?connected=meta`)
  } catch (err) {
    console.error("Meta OAuth callback error:", err)
    res.redirect(`${FRONTEND_SETTINGS}?error=oauth_failed`)
  }
})

// DELETE /api/integrations/meta
router.delete("/meta", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  await pool.query(
    "DELETE FROM ad_accounts WHERE dealership_id = $1 AND platform = 'meta'",
    [dealershipId]
  )
  res.json({ disconnected: true })
})

export default router
```

- [ ] **Step 5: Register the router in app.ts**

Modify `backend/src/app.ts`:

```typescript
import cors from "cors"
import express from "express"
import healthRouter from "./routes/health.js"
import authRouter from "./routes/auth.js"
import dashboardRouter from "./routes/dashboard.js"
import integrationsRouter from "./routes/integrations.js"

const app = express()

app.use(cors({ origin: "http://localhost:3000", credentials: true }))
app.use(express.json())

app.use("/api/health", healthRouter)
app.use("/api/auth", authRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/integrations", integrationsRouter)

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" })
})

export default app
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npm test integrations
```

Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/integrations.ts backend/src/app.ts backend/src/routes/integrations.test.ts
git commit -m "feat: add Google Ads and Meta OAuth account connection flows"
```

---

## Task 8: Wire Settings Page to Real API

**Files:**
- Modify: `frontend/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Replace mock settings page**

Replace the full content of `frontend/app/dashboard/settings/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"

interface ConnectedAccount {
  platform: "google" | "meta"
  account_name: string
  connected_at: string
}

interface AuthData {
  connectedAccounts: ConnectedAccount[]
}

export default function SettingsPage() {
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    api.auth.me().then((data) => {
      setAuthData(data as AuthData)
      setLoading(false)
    })
  }, [])

  const connected = (platform: "google" | "meta") =>
    authData?.connectedAccounts.find((a) => a.platform === platform)

  async function handleConnect(platform: "google" | "meta") {
    const { url } =
      platform === "google"
        ? await api.integrations.google.authUrl()
        : await api.integrations.meta.authUrl()
    window.location.href = url
  }

  async function handleDisconnect(platform: "google" | "meta") {
    if (!confirm(`Disconnect ${platform} account?`)) return
    platform === "google"
      ? await api.integrations.google.disconnect()
      : await api.integrations.meta.disconnect()
    const data = await api.auth.me()
    setAuthData(data as AuthData)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  const successPlatform = searchParams.get("connected")
  const errorParam = searchParams.get("error")

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-navy-900 mb-6">Connect Ad Accounts</h1>

      {successPlatform && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded">
          {successPlatform === "google" ? "Google Ads" : "Meta Ads"} connected successfully.
        </div>
      )}
      {errorParam && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded">
          Connection failed: {errorParam}. Please try again.
        </div>
      )}

      {(["google", "meta"] as const).map((platform) => {
        const account = connected(platform)
        return (
          <div key={platform} className="mb-4 p-6 bg-white border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-semibold capitalize">{platform === "google" ? "Google Ads" : "Meta Ads"}</div>
              {account ? (
                <div className="text-sm text-green-600 mt-1">✓ {account.account_name}</div>
              ) : (
                <div className="text-sm text-gray-400 mt-1">Not connected</div>
              )}
            </div>
            {account ? (
              <button
                onClick={() => handleDisconnect(platform)}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={() => handleConnect(platform)}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Connect
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Test manually**

```bash
# Start both servers if not running
cd backend && npm run dev
cd frontend && npm run dev
```

Navigate to http://localhost:3000/dashboard/settings. Verify Connect buttons appear, clicking Google redirects to Google OAuth.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/settings/page.tsx
git commit -m "feat: wire settings page to real OAuth connect/disconnect API"
```

---

**Phase 1 complete when:** User can sign in with Google → user row created in DB → can connect Google Ads + Meta sandbox accounts → tokens stored encrypted → `/dashboard/*` routes protected → `/api/auth/me` returns real user data.
