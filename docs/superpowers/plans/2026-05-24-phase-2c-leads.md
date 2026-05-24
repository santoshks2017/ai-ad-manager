# Phase 2c: Lead Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest leads from Google Lead Forms (polling) and Meta Lead Ads (webhook), expose CRUD endpoints with filtering/pagination, implement CSV export, and wire the full lead inbox frontend with status management and phone reveal.

**Architecture:** Google leads are fetched via polling every 5 minutes (tracking last poll timestamp in DB). Meta leads arrive via webhook — Meta calls our endpoint when a new lead submits. Both normalize to the same `NormalizedLead` shape before upsert. The leads route masks phone numbers by default; full phone is returned only on the single-lead detail endpoint.

**Tech Stack:** googleapis, axios, node-cron, csv-stringify, vitest, supertest

**Entry condition:** Phase 1 complete — auth working, ad accounts connected.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/services/lead-sync.ts` | Google lead polling + normalization |
| Create | `backend/src/services/lead-sync.test.ts` | Unit tests for normalization + masking |
| Create | `backend/src/cron/sync-leads.ts` | 5-min polling cron |
| Create | `backend/src/routes/leads.ts` | All lead CRUD + export routes |
| Create | `backend/src/routes/webhooks.ts` | Meta webhook receiver + verify |
| Create | `backend/src/routes/leads.test.ts` | API integration tests |
| Modify | `backend/src/app.ts` | Register leads + webhooks routers + cron |
| Modify | `frontend/app/dashboard/leads/page.tsx` | Wire real data, all interactions |
| Modify | `frontend/components/ui/Sidebar.tsx` | New leads badge count |

---

## Task 1: Lead Normalization and Masking Service

**Files:**
- Create: `backend/src/services/lead-sync.ts`
- Create: `backend/src/services/lead-sync.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `backend/src/services/lead-sync.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { maskPhone, normalizeGoogleLead, normalizeMetaLead } from "./lead-sync.js"

describe("maskPhone", () => {
  it("shows only last 4 digits", () => {
    expect(maskPhone("9876543210")).toBe("******3210")
  })

  it("handles short phone numbers", () => {
    expect(maskPhone("1234")).toBe("1234")
  })

  it("handles empty string", () => {
    expect(maskPhone("")).toBe("")
  })
})

describe("normalizeGoogleLead", () => {
  it("maps Google lead form submission to NormalizedLead", () => {
    const raw = {
      leadFormUserSubmission: {
        resourceName: "customers/123/leadFormUserSubmissions/abc-lead-id",
        columnData: [
          { columnId: "FULL_NAME", stringValue: "Santosh Kumar" },
          { columnId: "PHONE_NUMBER", stringValue: "9876543210" },
          { columnId: "EMAIL", stringValue: "santosh@example.com" },
        ],
        submissionDateTime: "2026-05-20 10:30:00",
      },
      campaign: { id: "campaign-123", name: "Swift Launch" },
    }
    const result = normalizeGoogleLead(raw)
    expect(result.platformLeadId).toBe("abc-lead-id")
    expect(result.platform).toBe("google")
    expect(result.name).toBe("Santosh Kumar")
    expect(result.phone).toBe("9876543210")
    expect(result.email).toBe("santosh@example.com")
    expect(result.campaignId).toBe("campaign-123")
  })
})

describe("normalizeMetaLead", () => {
  it("maps Meta lead gen data to NormalizedLead", () => {
    const raw = {
      id: "meta-lead-789",
      field_data: [
        { name: "full_name", values: ["Priya Sharma"] },
        { name: "phone_number", values: ["+919876543210"] },
        { name: "email", values: ["priya@example.com"] },
      ],
      created_time: "2026-05-20T10:30:00+0000",
      ad_id: "meta-ad-456",
    }
    const campaignId = "meta-campaign-123"
    const result = normalizeMetaLead(raw, campaignId)
    expect(result.platformLeadId).toBe("meta-lead-789")
    expect(result.platform).toBe("meta")
    expect(result.name).toBe("Priya Sharma")
    expect(result.phone).toBe("+919876543210")
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test lead-sync
```

Expected: FAIL

- [ ] **Step 3: Implement the service**

Create `backend/src/services/lead-sync.ts`:

```typescript
import { google } from "googleapis"
import axios from "axios"
import { pool } from "../db.js"
import { decryptToken } from "./token-store.js"
import type { NormalizedLead } from "../types.js"

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  return "*".repeat(phone.length - 4) + phone.slice(-4)
}

export function normalizeGoogleLead(submission: any): NormalizedLead {
  const resource = submission.leadFormUserSubmission?.resourceName ?? ""
  const platformLeadId = resource.split("/").pop() ?? resource

  const fields: Record<string, string> = {}
  for (const col of submission.leadFormUserSubmission?.columnData ?? []) {
    fields[col.columnId] = col.stringValue ?? ""
  }

  return {
    platformLeadId,
    platform: "google",
    campaignId: String(submission.campaign?.id ?? ""),
    name: fields["FULL_NAME"] ?? "",
    phone: fields["PHONE_NUMBER"] ?? "",
    email: fields["EMAIL"] ?? "",
    receivedAt: submission.leadFormUserSubmission?.submissionDateTime ?? new Date().toISOString(),
  }
}

export function normalizeMetaLead(leadData: any, campaignId: string): NormalizedLead {
  const fieldMap: Record<string, string> = {}
  for (const field of leadData.field_data ?? []) {
    fieldMap[field.name] = field.values?.[0] ?? ""
  }

  return {
    platformLeadId: String(leadData.id),
    platform: "meta",
    campaignId,
    name: fieldMap["full_name"] ?? fieldMap["name"] ?? "",
    phone: fieldMap["phone_number"] ?? fieldMap["phone"] ?? "",
    email: fieldMap["email"] ?? "",
    receivedAt: leadData.created_time ?? new Date().toISOString(),
  }
}

async function upsertLead(dealershipId: string, lead: NormalizedLead) {
  // Find campaign_id from DB using platform campaign id
  const campaignResult = await pool.query(
    `SELECT id FROM campaigns WHERE dealership_id = $1 AND (
      ($2 = 'google' AND google_campaign_id = $3) OR
      ($2 = 'meta' AND meta_campaign_id = $3)
    )`,
    [dealershipId, lead.platform, lead.campaignId]
  )
  const dbCampaignId = campaignResult.rows[0]?.id ?? null

  await pool.query(
    `INSERT INTO leads (dealership_id, campaign_id, platform, platform_lead_id, name, phone, email, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (platform_lead_id) DO NOTHING`,
    [dealershipId, dbCampaignId, lead.platform, lead.platformLeadId, lead.name, lead.phone, lead.email, lead.receivedAt]
  )
}

export async function pollGoogleLeads(dealershipId: string) {
  const accountResult = await pool.query(
    "SELECT access_token, refresh_token, platform_account_id FROM ad_accounts WHERE dealership_id = $1 AND platform = 'google'",
    [dealershipId]
  )
  if (!accountResult.rows[0]) return

  const acc = accountResult.rows[0]
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: decryptToken(acc.access_token),
    refresh_token: acc.refresh_token ? decryptToken(acc.refresh_token) : undefined,
  })

  const customerId = acc.platform_account_id
  const since = new Date(Date.now() - 6 * 60 * 1000).toISOString() // last 6 minutes

  try {
    const adsClient = google.ads({ version: "v17", auth: oauth2Client })
    const gaql = `
      SELECT
        lead_form_user_submission.resource_name,
        lead_form_user_submission.column_data,
        lead_form_user_submission.submission_date_time,
        campaign.id,
        campaign.name
      FROM lead_form_user_submission
      WHERE lead_form_user_submission.submission_date_time >= '${since}'
    `
    const response = await adsClient.customers.googleAds.search({
      customerId,
      requestBody: { query: gaql },
    })

    for (const row of response.data.results ?? []) {
      const lead = normalizeGoogleLead(row)
      await upsertLead(dealershipId, lead)
    }
  } catch (err) {
    console.error(`[lead-sync] Google poll error for dealership ${dealershipId}:`, err)
  }
}

export async function fetchAndSaveMetaLead(leadId: string, accessToken: string, dealershipId: string, campaignId: string) {
  try {
    const res = await axios.get(`https://graph.facebook.com/v19.0/${leadId}`, {
      params: {
        access_token: accessToken,
        fields: "id,field_data,created_time,ad_id",
      },
    })
    const lead = normalizeMetaLead(res.data, campaignId)
    await upsertLead(dealershipId, lead)
  } catch (err) {
    console.error("[lead-sync] Meta lead fetch error:", err)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test lead-sync
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/lead-sync.ts backend/src/services/lead-sync.test.ts
git commit -m "feat: add lead normalization service with phone masking"
```

---

## Task 2: Lead Sync Cron

**Files:**
- Create: `backend/src/cron/sync-leads.ts`

- [ ] **Step 1: Create the cron**

Create `backend/src/cron/sync-leads.ts`:

```typescript
import cron from "node-cron"
import { pool } from "../db.js"
import { pollGoogleLeads } from "../services/lead-sync.js"

export async function syncAllLeads() {
  const dealerships = await pool.query(
    "SELECT DISTINCT dealership_id FROM ad_accounts WHERE platform = 'google'"
  )
  await Promise.all(
    dealerships.rows.map((row) => pollGoogleLeads(row.dealership_id))
  )
  console.log(`[sync-leads] Google leads synced at ${new Date().toISOString()}`)
}

export function startLeadSyncCron() {
  cron.schedule("*/5 * * * *", () => {
    syncAllLeads().catch(console.error)
  })
  console.log("[sync-leads] Cron started — runs every 5 minutes")
}
```

- [ ] **Step 2: Register cron in index.ts**

Modify `backend/src/index.ts`:

```typescript
import dotenv from "dotenv"
import app from "./app.js"
import { startMetricsSyncCron } from "./cron/sync-metrics.js"
import { startLeadSyncCron } from "./cron/sync-leads.js"

dotenv.config()

const port = Number(process.env.PORT ?? 4000)

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`)
  startMetricsSyncCron()
  startLeadSyncCron()
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/cron/sync-leads.ts backend/src/index.ts
git commit -m "feat: add 5-minute Google lead polling cron"
```

---

## Task 3: Meta Webhook Routes

**Files:**
- Create: `backend/src/routes/webhooks.ts`

- [ ] **Step 1: Create webhook routes**

Create `backend/src/routes/webhooks.ts`:

```typescript
import express from "express"
import crypto from "crypto"
import { pool } from "../db.js"
import { fetchAndSaveMetaLead } from "../services/lead-sync.js"
import { decryptToken } from "../services/token-store.js"

const router = express.Router()

// GET /api/webhooks/meta/verify — Meta verification challenge
router.get("/meta/verify", (req, res) => {
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.status(403).json({ error: "Verification failed" })
  }
})

// POST /api/webhooks/meta/leads — Meta lead notification
router.post("/meta/leads", async (req, res) => {
  // Verify signature
  const signature = req.headers["x-hub-signature-256"] as string
  const body = JSON.stringify(req.body)
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.META_APP_SECRET ?? "")
    .update(body)
    .digest("hex")

  if (signature !== expected) {
    res.status(401).json({ error: "Invalid signature" })
    return
  }

  // Process each entry
  const entries = req.body.entry ?? []
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue

      const leadId = change.value?.leadgen_id
      const adAccountId = change.value?.ad_account_id
      const campaignId = change.value?.campaign_id ?? ""

      if (!leadId || !adAccountId) continue

      // Find dealership by Meta ad account
      const accountResult = await pool.query(
        "SELECT dealership_id, access_token FROM ad_accounts WHERE platform = 'meta' AND platform_account_id = $1",
        [adAccountId]
      )
      if (!accountResult.rows[0]) continue

      const { dealership_id: dealershipId, access_token: encryptedToken } = accountResult.rows[0]
      const accessToken = decryptToken(encryptedToken)

      await fetchAndSaveMetaLead(leadId, accessToken, dealershipId, campaignId)
    }
  }

  res.json({ received: true })
})

export default router
```

- [ ] **Step 2: Register router in app.ts**

Add to `backend/src/app.ts`:

```typescript
import webhooksRouter from "./routes/webhooks.js"
// ...after existing router registrations:
app.use("/api/webhooks", webhooksRouter)
```

Also add `META_WEBHOOK_VERIFY_TOKEN=local-webhook-verify-token` to `backend/.env`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/webhooks.ts backend/src/app.ts
git commit -m "feat: add Meta lead ads webhook receiver with signature verification"
```

---

## Task 4: Lead CRUD Routes

**Files:**
- Create: `backend/src/routes/leads.ts`
- Create: `backend/src/routes/leads.test.ts`

- [ ] **Step 1: Install csv-stringify**

```bash
cd backend && npm install csv-stringify
```

- [ ] **Step 2: Write failing API tests**

Create `backend/src/routes/leads.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../app.js"
import { clearTables, seedDealership, seedUser } from "../test/helpers.js"
import { testPool } from "../test/setup.js"

const SECRET = "local-dev-secret-change-in-prod-32chars"
process.env.NEXTAUTH_SECRET = SECRET
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test"

function makeToken(userId: string, dealershipId: string) {
  return jwt.sign({ userId, dealershipId }, SECRET, { algorithm: "HS256" })
}

async function seedLead(dealershipId: string, overrides: Record<string, any> = {}) {
  const { rows } = await testPool.query(
    `INSERT INTO leads (dealership_id, platform, platform_lead_id, name, phone, email, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      dealershipId,
      overrides.platform ?? "google",
      overrides.platformLeadId ?? `lead-${Date.now()}-${Math.random()}`,
      overrides.name ?? "Test User",
      overrides.phone ?? "9876543210",
      overrides.email ?? "test@example.com",
      overrides.status ?? "new",
    ]
  )
  return rows[0]
}

describe("GET /api/leads", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    await seedLead(dealership.id, { status: "new", phone: "9876543210" })
    await seedLead(dealership.id, { status: "contacted", phone: "9876543211" })
  })

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/leads")
    expect(res.status).toBe(401)
  })

  it("returns paginated leads with masked phone", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/leads")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.leads).toHaveLength(2)
    expect(res.body.leads[0].phone).toContain("*")
    expect(res.body.total).toBe(2)
  })

  it("filters by status", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/leads?status=new")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.leads).toHaveLength(1)
    expect(res.body.leads[0].status).toBe("new")
  })
})

describe("GET /api/leads/:id", () => {
  let dealership: any, user: any, lead: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    lead = await seedLead(dealership.id, { phone: "9876543210" })
  })

  it("returns full phone unmasked", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get(`/api/leads/${lead.id}`)
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.phone).toBe("9876543210")
  })
})

describe("PATCH /api/leads/:id", () => {
  let dealership: any, user: any, lead: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    lead = await seedLead(dealership.id)
  })

  it("updates status", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .patch(`/api/leads/${lead.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "contacted" })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("contacted")
  })

  it("updates notes", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .patch(`/api/leads/${lead.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "Called twice, interested" })
    expect(res.status).toBe(200)
    expect(res.body.notes).toBe("Called twice, interested")
  })
})

describe("GET /api/leads/count", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    await seedLead(dealership.id, { status: "new" })
    await seedLead(dealership.id, { status: "new" })
    await seedLead(dealership.id, { status: "contacted" })
  })

  it("returns count of new leads", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/leads/count")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
  })
})
```

- [ ] **Step 3: Run to verify failure**

```bash
cd backend && npm test routes/leads
```

Expected: FAIL — 404

- [ ] **Step 4: Implement leads router**

Create `backend/src/routes/leads.ts`:

```typescript
import express from "express"
import { stringify } from "csv-stringify/sync"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { maskPhone } from "../services/lead-sync.js"

const router = express.Router()

const VALID_STATUSES = new Set(["new", "contacted", "qualified", "lost"])

// GET /api/leads/count — must be before /:id
router.get("/count", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const result = await pool.query(
    "SELECT COUNT(*) FROM leads WHERE dealership_id = $1 AND status = 'new'",
    [dealershipId]
  )
  res.json({ count: parseInt(result.rows[0].count) })
})

// GET /api/leads/export — must be before /:id
router.get("/export", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { status, platform, search } = req.query as Record<string, string>

  let query = "SELECT l.*, c.name as campaign_name FROM leads l LEFT JOIN campaigns c ON l.campaign_id = c.id WHERE l.dealership_id = $1"
  const params: any[] = [dealershipId]

  if (status) { params.push(status); query += ` AND l.status = $${params.length}` }
  if (platform) { params.push(platform); query += ` AND l.platform = $${params.length}` }
  if (search) { params.push(`%${search}%`); query += ` AND (l.name ILIKE $${params.length} OR l.phone ILIKE $${params.length})` }

  query += " ORDER BY l.received_at DESC"

  const result = await pool.query(query, params)

  const csvRows = result.rows.map((lead) => ({
    Name: lead.name,
    Phone: lead.phone,
    Email: lead.email,
    Platform: lead.platform,
    Campaign: lead.campaign_name ?? "",
    Status: lead.status,
    "Received At": lead.received_at,
    Notes: lead.notes ?? "",
  }))

  const csv = stringify(csvRows, { header: true })
  res.setHeader("Content-Type", "text/csv")
  res.setHeader("Content-Disposition", `attachment; filename=leads-${Date.now()}.csv`)
  res.send(csv)
})

// GET /api/leads
router.get("/", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { status, platform, campaign_id, search, page = "1" } = req.query as Record<string, string>
  const pageNum = Math.max(1, parseInt(page))
  const limit = 50
  const offset = (pageNum - 1) * limit

  let query = "SELECT l.*, c.name as campaign_name FROM leads l LEFT JOIN campaigns c ON l.campaign_id = c.id WHERE l.dealership_id = $1"
  const params: any[] = [dealershipId]

  if (status) { params.push(status); query += ` AND l.status = $${params.length}` }
  if (platform) { params.push(platform); query += ` AND l.platform = $${params.length}` }
  if (campaign_id) { params.push(campaign_id); query += ` AND l.campaign_id = $${params.length}` }
  if (search) { params.push(`%${search}%`); query += ` AND (l.name ILIKE $${params.length} OR l.phone ILIKE $${params.length})` }

  const countResult = await pool.query(
    query.replace("SELECT l.*, c.name as campaign_name", "SELECT COUNT(*)"),
    params
  )

  params.push(limit, offset)
  query += ` ORDER BY l.received_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

  const result = await pool.query(query, params)
  const leads = result.rows.map((lead) => ({
    ...lead,
    phone: maskPhone(lead.phone ?? ""),
  }))

  res.json({ leads, total: parseInt(countResult.rows[0].count), page: pageNum })
})

// GET /api/leads/:id — full detail, phone unmasked
router.get("/:id", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { id } = req.params

  const result = await pool.query(
    `SELECT l.*, c.name as campaign_name FROM leads l
     LEFT JOIN campaigns c ON l.campaign_id = c.id
     WHERE l.id = $1 AND l.dealership_id = $2`,
    [id, dealershipId]
  )
  if (!result.rows[0]) { res.status(404).json({ error: "Lead not found" }); return }
  res.json(result.rows[0])
})

// PATCH /api/leads/:id
router.patch("/:id", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { id } = req.params
  const { status, notes } = req.body

  if (status && !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: "Invalid status. Must be: new, contacted, qualified, lost" })
    return
  }

  const fields: string[] = []
  const values: any[] = []

  if (status !== undefined) { fields.push(`status = $${fields.length + 1}`); values.push(status) }
  if (notes !== undefined) { fields.push(`notes = $${fields.length + 1}`); values.push(notes) }

  if (fields.length === 0) { res.status(400).json({ error: "No fields to update" }); return }

  values.push(id, dealershipId)
  const result = await pool.query(
    `UPDATE leads SET ${fields.join(", ")} WHERE id = $${values.length - 1} AND dealership_id = $${values.length} RETURNING *`,
    values
  )
  if (!result.rows[0]) { res.status(404).json({ error: "Lead not found" }); return }
  res.json(result.rows[0])
})

export default router
```

- [ ] **Step 5: Register router in app.ts**

Add to `backend/src/app.ts`:

```typescript
import leadsRouter from "./routes/leads.js"
// ...after existing routers:
app.use("/api/leads", leadsRouter)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npm test routes/leads
```

Expected: 7 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/leads.ts backend/src/routes/leads.test.ts backend/src/app.ts
git commit -m "feat: add lead inbox CRUD routes with filtering, pagination, and CSV export"
```

---

## Task 5: Wire Lead Inbox Frontend

**Files:**
- Modify: `frontend/app/dashboard/leads/page.tsx`
- Modify: `frontend/components/ui/Sidebar.tsx`

- [ ] **Step 1: Replace mock leads page**

Replace `frontend/app/dashboard/leads/page.tsx`:

```tsx
"use client"

import { useState, useRef } from "react"
import useSWR, { mutate } from "swr"
import { api } from "@/lib/api"

const STATUS_OPTIONS = ["new", "contacted", "qualified", "lost"] as const
type LeadStatus = typeof STATUS_OPTIONS[number]

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
}

export default function LeadsPage() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [platformFilter, setPlatformFilter] = useState("")
  const [revealedPhone, setRevealedPhone] = useState<Record<string, string>>({})
  const notesTimerRef = useRef<NodeJS.Timeout>()

  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (statusFilter) params.set("status", statusFilter)
  if (platformFilter) params.set("platform", platformFilter)

  const { data, isLoading } = useSWR(
    `leads-${params.toString()}`,
    () => api.leads.list(params.toString())
  )

  const { data: selectedLead } = useSWR(
    selectedLeadId ? `lead-${selectedLeadId}` : null,
    () => selectedLeadId ? api.leads.get(selectedLeadId) : null
  )

  async function handleStatusChange(leadId: string, status: string) {
    await api.leads.update(leadId, { status })
    mutate(`leads-${params.toString()}`)
    if (selectedLeadId === leadId) mutate(`lead-${leadId}`)
  }

  function handleNotesChange(leadId: string, notes: string) {
    clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(async () => {
      await api.leads.update(leadId, { notes })
    }, 500)
  }

  async function handleRevealPhone(leadId: string) {
    if (revealedPhone[leadId]) return
    const lead = await api.leads.get(leadId)
    setRevealedPhone((prev) => ({ ...prev, [leadId]: lead.phone }))
  }

  function handleExport() {
    const exportParams = new URLSearchParams()
    if (search) exportParams.set("search", search)
    if (statusFilter) exportParams.set("status", statusFilter)
    if (platformFilter) exportParams.set("platform", platformFilter)
    window.location.href = api.leads.exportUrl(exportParams.toString())
  }

  const leads = data?.leads ?? []

  return (
    <div className="flex h-full">
      {/* Lead List */}
      <div className="w-full lg:w-1/2 xl:w-2/5 border-r border-gray-200 flex flex-col">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
            <button
              onClick={handleExport}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
            >
              Export CSV
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="">All Platforms</option>
              <option value="google">Google</option>
              <option value="meta">Meta</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-4 text-gray-400 text-sm">Loading...</div>}
          {leads.map((lead: any) => (
            <button
              key={lead.id}
              onClick={() => setSelectedLeadId(lead.id)}
              className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                selectedLeadId === lead.id ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 text-sm">{lead.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status as LeadStatus]}`}>
                  {lead.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex gap-2">
                <span>{lead.phone}</span>
                <span className="capitalize">{lead.platform}</span>
                <span>{lead.campaign_name ?? "—"}</span>
              </div>
            </button>
          ))}
          {!isLoading && leads.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">No leads yet. Your campaign is running — leads appear within 5 minutes of form submission.</div>
          )}
        </div>

        <div className="p-2 border-t border-gray-100 text-xs text-gray-400 text-right">
          {data?.total ?? 0} leads total
        </div>
      </div>

      {/* Lead Detail */}
      <div className="hidden lg:flex flex-1 flex-col">
        {selectedLead ? (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{selectedLead.name}</h2>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-xs text-gray-400 uppercase">Phone</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">
                    {revealedPhone[selectedLead.id] ?? selectedLead.phone}
                  </span>
                  {!revealedPhone[selectedLead.id] && (
                    <button
                      onClick={() => handleRevealPhone(selectedLead.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Reveal
                    </button>
                  )}
                  {revealedPhone[selectedLead.id] && (
                    <a
                      href={`tel:${revealedPhone[selectedLead.id]}`}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Call
                    </a>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase">Email</span>
                <div className="text-sm">{selectedLead.email || "—"}</div>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase">Source</span>
                <div className="text-sm capitalize">{selectedLead.platform} · {selectedLead.campaign_name ?? "—"}</div>
              </div>
              <div>
                <span className="text-xs text-gray-400 uppercase">Received</span>
                <div className="text-sm">{new Date(selectedLead.received_at).toLocaleString("en-IN")}</div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-400 uppercase block mb-1">Status</label>
              <select
                defaultValue={selectedLead.status}
                onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase block mb-1">Notes</label>
              <textarea
                key={selectedLead.id}
                defaultValue={selectedLead.notes ?? ""}
                onChange={(e) => handleNotesChange(selectedLead.id, e.target.value)}
                rows={4}
                placeholder="Add notes..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a lead to view details
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Read current Sidebar.tsx to understand its structure**

```bash
cat frontend/components/ui/Sidebar.tsx
```

- [ ] **Step 3: Add new leads badge to Sidebar**

In `frontend/components/ui/Sidebar.tsx`, add a badge on the Leads nav link. Add these lines to the component (adapt to the existing nav link structure):

```tsx
// Add at the top of the file:
"use client"
import useSWR from "swr"
import { api } from "@/lib/api"

// Inside the component, add:
const { data: leadCount } = useSWR("lead-count", api.leads.count, { refreshInterval: 120000 })

// On the Leads nav link, add the badge:
{leadCount?.count > 0 && (
  <span className="ml-auto bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
    {leadCount.count}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/leads/page.tsx frontend/components/ui/Sidebar.tsx
git commit -m "feat: wire lead inbox to real API with status, notes, phone reveal, and export"
```

---

**Phase 2c complete when:** Leads appear within 5 minutes of sandbox form submission, status/notes auto-save, phone reveal works, CSV export downloads correctly, new leads badge updates every 2 minutes.
