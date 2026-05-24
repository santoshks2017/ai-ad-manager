# Phase 2b: Campaign Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 5 campaign templates, wire campaign creation to Google Ads and Meta sandbox APIs, implement list/pause/resume, and build the 3-step campaign creation flow in the frontend.

**Architecture:** Templates are static JSON. Two platform services (google-ads-campaigns, meta-ads-campaigns) each accept a unified `CampaignParams` object and return the platform-assigned campaign ID. `POST /api/campaigns/create` calls one or both; on partial failure it rolls back the successful platform before returning an error. Campaign list reads from the campaigns DB table joined with metrics_cache for spend/leads.

**Tech Stack:** googleapis, axios, vitest, supertest

**Entry condition:** Phase 1 complete — users authenticated, ad accounts connected.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/data/templates.json` | 5 static campaign templates |
| Create | `backend/src/services/google-ads-campaigns.ts` | Create/pause/resume Google campaigns |
| Create | `backend/src/services/meta-ads-campaigns.ts` | Create/pause/resume Meta campaigns |
| Create | `backend/src/routes/campaigns.ts` | All campaign CRUD routes |
| Modify | `backend/src/app.ts` | Register campaigns router |
| Create | `backend/src/services/google-ads-campaigns.test.ts` | Unit tests for payload builder |
| Create | `backend/src/routes/campaigns.test.ts` | API integration tests |
| Modify | `frontend/app/dashboard/campaigns/page.tsx` | Real data + pause/resume |
| Create | `frontend/app/dashboard/campaigns/new/page.tsx` | Template picker |
| Create | `frontend/app/dashboard/campaigns/new/[templateId]/page.tsx` | 3-step form |

---

## Task 1: Campaign Templates Data

**Files:**
- Create: `backend/src/data/templates.json`

- [ ] **Step 1: Create the templates file**

Create `backend/src/data/templates.json`:

```json
[
  {
    "id": "model_launch",
    "name": "Model Launch",
    "useCase": "Announce a new car model in your showroom",
    "headline": "New {{carModel}} Now Available — Book Your Test Drive",
    "description": "Experience the all-new {{carModel}}. Visit us today for an exclusive preview and special launch offers.",
    "cta": "Book Test Drive",
    "thumbnailColor": "#1e40af",
    "mostUsed": true
  },
  {
    "id": "test_drive",
    "name": "Test Drive Offer",
    "useCase": "Drive walk-ins with a compelling test drive CTA",
    "headline": "Book a Free {{carModel}} Test Drive Today",
    "description": "Take the {{carModel}} for a spin. No commitment needed. Book your free test drive at our showroom.",
    "cta": "Book Now",
    "thumbnailColor": "#059669",
    "mostUsed": true
  },
  {
    "id": "exchange",
    "name": "Exchange Offer",
    "useCase": "Attract customers looking to trade in their old car",
    "headline": "Exchange Your Old Car — Get Extra ₹50,000 on {{carModel}}",
    "description": "Upgrade to the {{carModel}} and get an extra bonus on your old car exchange. Limited period offer.",
    "cta": "Get Exchange Offer",
    "thumbnailColor": "#7c3aed",
    "mostUsed": false
  },
  {
    "id": "festive",
    "name": "Festive Sale",
    "useCase": "Run during Diwali, Navratri, or other festive seasons",
    "headline": "Festive Offer on {{carModel}} — Special Diwali Discounts",
    "description": "Celebrate the festive season with exclusive discounts on the {{carModel}}. Drive home your dream car today.",
    "cta": "Claim Offer",
    "thumbnailColor": "#d97706",
    "mostUsed": false
  },
  {
    "id": "clearance",
    "name": "Year-End Clearance",
    "useCase": "Clear previous year inventory before new models arrive",
    "headline": "Year-End Clearance — {{carModel}} at Best Prices",
    "description": "Limited stock available. Get the {{carModel}} at unbeatable year-end prices before the new batch arrives.",
    "cta": "Check Price",
    "thumbnailColor": "#dc2626",
    "mostUsed": false
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/data/templates.json
git commit -m "feat: add 5 campaign templates"
```

---

## Task 2: Google Ads Campaign Service

**Files:**
- Create: `backend/src/services/google-ads-campaigns.ts`
- Create: `backend/src/services/google-ads-campaigns.test.ts`

- [ ] **Step 1: Write failing unit test for the payload builder**

Create `backend/src/services/google-ads-campaigns.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { buildGoogleCampaignPayload, substituteTemplate } from "./google-ads-campaigns.js"

describe("substituteTemplate", () => {
  it("replaces {{carModel}} placeholder", () => {
    const result = substituteTemplate("New {{carModel}} Available", "Maruti Swift")
    expect(result).toBe("New Maruti Swift Available")
  })

  it("handles missing carModel gracefully", () => {
    const result = substituteTemplate("{{carModel}} Launch", "")
    expect(result).toBe(" Launch")
  })
})

describe("buildGoogleCampaignPayload", () => {
  it("sets campaign name from template and car model", () => {
    const params = {
      name: "Swift Model Launch",
      budget: 5000,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      targetLocation: "Pune",
      headline: "New Maruti Swift Available",
      description: "Book your test drive today",
    }
    const payload = buildGoogleCampaignPayload(params)
    expect(payload.campaign.name).toBe("Swift Model Launch")
    expect(payload.campaign.campaignBudget).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test google-ads-campaigns
```

Expected: FAIL

- [ ] **Step 3: Implement the service**

Create `backend/src/services/google-ads-campaigns.ts`:

```typescript
import { google } from "googleapis"
import { decryptToken } from "./token-store.js"

export interface CampaignParams {
  name: string
  budget: number
  startDate: string
  endDate: string
  targetLocation: string
  headline: string
  description: string
}

export function substituteTemplate(template: string, carModel: string): string {
  return template.replace(/\{\{carModel\}\}/g, carModel)
}

export function buildGoogleCampaignPayload(params: CampaignParams) {
  const dailyBudgetMicros = Math.round((params.budget / 30) * 1_000_000)
  return {
    campaign: {
      name: params.name,
      advertisingChannelType: "SEARCH",
      status: "ENABLED",
      campaignBudget: {
        amountMicros: String(dailyBudgetMicros),
        deliveryMethod: "STANDARD",
      },
      startDate: params.startDate.replace(/-/g, ""),
      endDate: params.endDate.replace(/-/g, ""),
      manualCpc: {},
    },
  }
}

export async function createGoogleCampaign(
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  customerId: string,
  params: CampaignParams
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: decryptToken(encryptedAccessToken),
    refresh_token: encryptedRefreshToken ? decryptToken(encryptedRefreshToken) : undefined,
  })

  const adsClient = google.ads({ version: "v17", auth: oauth2Client })

  // 1. Create campaign
  const campaignRes = await adsClient.customers.campaigns.mutate({
    customerId,
    requestBody: {
      operations: [{ create: buildGoogleCampaignPayload(params).campaign }],
    },
  })
  const campaignResourceName = campaignRes.data.results?.[0]?.resourceName ?? ""
  const campaignId = campaignResourceName.split("/").pop() ?? ""

  // 2. Create ad group
  const adGroupRes = await adsClient.customers.adGroups.mutate({
    customerId,
    requestBody: {
      operations: [{
        create: {
          name: `${params.name} - Ad Group`,
          campaign: campaignResourceName,
          status: "ENABLED",
          cpcBidMicros: "1000000",
        },
      }],
    },
  })
  const adGroupResourceName = adGroupRes.data.results?.[0]?.resourceName ?? ""

  // 3. Create responsive search ad
  await adsClient.customers.ads.mutate({
    customerId,
    requestBody: {
      operations: [{
        create: {
          adGroup: adGroupResourceName,
          status: "ENABLED",
          ad: {
            responsiveSearchAd: {
              headlines: [
                { text: params.headline.slice(0, 30) },
                { text: params.name.slice(0, 30) },
                { text: "Visit Our Showroom Today" },
              ],
              descriptions: [
                { text: params.description.slice(0, 90) },
                { text: "Book your test drive. Limited period offer." },
              ],
              path1: "Cars",
              path2: params.targetLocation.slice(0, 15),
            },
          },
        },
      }],
    },
  })

  return campaignId
}

export async function pauseGoogleCampaign(
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  customerId: string,
  googleCampaignId: string
): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: decryptToken(encryptedAccessToken),
    refresh_token: encryptedRefreshToken ? decryptToken(encryptedRefreshToken) : undefined,
  })
  const adsClient = google.ads({ version: "v17", auth: oauth2Client })
  await adsClient.customers.campaigns.mutate({
    customerId,
    requestBody: {
      operations: [{
        update: {
          resourceName: `customers/${customerId}/campaigns/${googleCampaignId}`,
          status: "PAUSED",
        },
        updateMask: "status",
      }],
    },
  })
}

export async function resumeGoogleCampaign(
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  customerId: string,
  googleCampaignId: string
): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: decryptToken(encryptedAccessToken),
    refresh_token: encryptedRefreshToken ? decryptToken(encryptedRefreshToken) : undefined,
  })
  const adsClient = google.ads({ version: "v17", auth: oauth2Client })
  await adsClient.customers.campaigns.mutate({
    customerId,
    requestBody: {
      operations: [{
        update: {
          resourceName: `customers/${customerId}/campaigns/${googleCampaignId}`,
          status: "ENABLED",
        },
        updateMask: "status",
      }],
    },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test google-ads-campaigns
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/google-ads-campaigns.ts backend/src/services/google-ads-campaigns.test.ts
git commit -m "feat: add Google Ads campaign creation and pause/resume service"
```

---

## Task 3: Meta Ads Campaign Service

**Files:**
- Create: `backend/src/services/meta-ads-campaigns.ts`

- [ ] **Step 1: Create the service**

Create `backend/src/services/meta-ads-campaigns.ts`:

```typescript
import axios from "axios"
import type { CampaignParams } from "./google-ads-campaigns.js"
import { decryptToken } from "./token-store.js"

export async function createMetaCampaign(
  encryptedAccessToken: string,
  adAccountId: string,
  params: CampaignParams
): Promise<string> {
  const accessToken = decryptToken(encryptedAccessToken)
  const baseUrl = `https://graph.facebook.com/v19.0/act_${adAccountId}`

  // 1. Create campaign
  const campaignRes = await axios.post(`${baseUrl}/campaigns`, {
    name: params.name,
    objective: "LEAD_GENERATION",
    status: "ACTIVE",
    special_ad_categories: [],
    access_token: accessToken,
  })
  const campaignId = campaignRes.data.id as string

  // 2. Create ad set
  const dailyBudget = Math.round((params.budget / 30) * 100) // cents
  const adSetRes = await axios.post(`${baseUrl}/adsets`, {
    name: `${params.name} - Ad Set`,
    campaign_id: campaignId,
    daily_budget: dailyBudget,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LEAD_GENERATION",
    targeting: {
      geo_locations: { cities: [{ name: params.targetLocation, country: "IN" }] },
    },
    start_time: new Date(params.startDate).toISOString(),
    end_time: new Date(params.endDate).toISOString(),
    status: "ACTIVE",
    access_token: accessToken,
  })
  const adSetId = adSetRes.data.id as string

  // 3. Create ad creative (image placeholder for MVP)
  const creativeRes = await axios.post(`${baseUrl}/adcreatives`, {
    name: `${params.name} - Creative`,
    object_story_spec: {
      page_id: process.env.META_PAGE_ID ?? "me",
      link_data: {
        message: params.description,
        link: process.env.META_WEBSITE_URL ?? "https://example.com",
        name: params.headline,
        call_to_action: { type: "LEARN_MORE" },
      },
    },
    access_token: accessToken,
  })

  // 4. Create ad
  await axios.post(`${baseUrl}/ads`, {
    name: `${params.name} - Ad`,
    adset_id: adSetId,
    creative: { creative_id: creativeRes.data.id },
    status: "ACTIVE",
    access_token: accessToken,
  })

  return campaignId
}

export async function setMetaCampaignStatus(
  encryptedAccessToken: string,
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<void> {
  const accessToken = decryptToken(encryptedAccessToken)
  await axios.post(`https://graph.facebook.com/v19.0/${metaCampaignId}`, {
    status,
    access_token: accessToken,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/meta-ads-campaigns.ts
git commit -m "feat: add Meta Ads campaign creation and status service"
```

---

## Task 4: Campaign Routes

**Files:**
- Create: `backend/src/routes/campaigns.ts`
- Create: `backend/src/routes/campaigns.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing API tests**

Create `backend/src/routes/campaigns.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import { clearTables, seedDealership, seedUser } from "../test/helpers.js"
import { testPool } from "../test/setup.js"
import app from "../app.js"

const SECRET = "local-dev-secret-change-in-prod-32chars"
process.env.NEXTAUTH_SECRET = SECRET
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test"
process.env.TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

vi.mock("../services/google-ads-campaigns.js", () => ({
  createGoogleCampaign: vi.fn().mockResolvedValue("google-campaign-123"),
  pauseGoogleCampaign: vi.fn().mockResolvedValue(undefined),
  resumeGoogleCampaign: vi.fn().mockResolvedValue(undefined),
  substituteTemplate: (t: string, m: string) => t.replace("{{carModel}}", m),
}))

vi.mock("../services/meta-ads-campaigns.js", () => ({
  createMetaCampaign: vi.fn().mockResolvedValue("meta-campaign-456"),
  setMetaCampaignStatus: vi.fn().mockResolvedValue(undefined),
}))

function makeToken(userId: string, dealershipId: string) {
  return jwt.sign({ userId, dealershipId }, SECRET, { algorithm: "HS256" })
}

const campaignBody = {
  name: "Swift Test Drive",
  templateId: "test_drive",
  carModel: "Maruti Swift",
  offerText: "Book now",
  budget: 5000,
  startDate: "2026-06-01",
  endDate: "2026-06-30",
  targetLocation: "Pune",
  platforms: ["google", "meta"],
  headline: "Book a Free Maruti Swift Test Drive",
  description: "Take the car for a spin",
}

describe("GET /api/campaigns/templates", () => {
  it("returns 5 templates without auth", async () => {
    const res = await request(app).get("/api/campaigns/templates")
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(5)
    expect(res.body[0]).toHaveProperty("id")
    expect(res.body[0]).toHaveProperty("headline")
  })
})

describe("POST /api/campaigns/create", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    await testPool.query(
      `INSERT INTO ad_accounts (dealership_id, platform, platform_account_id, account_name, access_token)
       VALUES ($1, 'google', '123', 'Google Ads', $2), ($1, 'meta', '456', 'Meta Ads', $2)`,
      [dealership.id, "0123456789abcdef:0123456789abcdef0123456789abcdef"]
    )
  })

  it("returns 401 without token", async () => {
    const res = await request(app).post("/api/campaigns/create").send(campaignBody)
    expect(res.status).toBe(401)
  })

  it("creates campaign and returns record", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .post("/api/campaigns/create")
      .set("Authorization", `Bearer ${token}`)
      .send(campaignBody)
    expect(res.status).toBe(201)
    expect(res.body.name).toBe("Swift Test Drive")
    expect(res.body.google_campaign_id).toBe("google-campaign-123")
    expect(res.body.meta_campaign_id).toBe("meta-campaign-456")
  })

  it("returns 400 when required fields missing", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .post("/api/campaigns/create")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Incomplete" })
    expect(res.status).toBe(400)
  })
})

describe("GET /api/campaigns", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    await testPool.query(
      `INSERT INTO campaigns (dealership_id, name, budget, start_date, end_date, platforms, status)
       VALUES ($1, 'Campaign A', 5000, '2026-06-01', '2026-06-30', '{google}', 'active'),
              ($1, 'Campaign B', 3000, '2026-06-01', '2026-06-30', '{meta}', 'paused')`,
      [dealership.id]
    )
  })

  it("returns campaigns for dealership", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/campaigns")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it("filters by status", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/campaigns?status=paused")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe("Campaign B")
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test routes/campaigns
```

Expected: FAIL — 404

- [ ] **Step 3: Implement the campaigns router**

Create `backend/src/routes/campaigns.ts`:

```typescript
import express from "express"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { createGoogleCampaign, pauseGoogleCampaign, resumeGoogleCampaign } from "../services/google-ads-campaigns.js"
import { createMetaCampaign, setMetaCampaignStatus } from "../services/meta-ads-campaigns.js"

const router = express.Router()
const __dirname = dirname(fileURLToPath(import.meta.url))
const templates = JSON.parse(
  readFileSync(join(__dirname, "../data/templates.json"), "utf-8")
)

router.get("/templates", (_req, res) => {
  res.json(templates)
})

router.get("/", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { status } = req.query as { status?: string }

  const query = status
    ? "SELECT * FROM campaigns WHERE dealership_id = $1 AND status = $2 ORDER BY created_at DESC"
    : "SELECT * FROM campaigns WHERE dealership_id = $1 ORDER BY created_at DESC"
  const params = status ? [dealershipId, status] : [dealershipId]

  const result = await pool.query(query, params)
  res.json(result.rows)
})

router.post("/create", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { name, carModel, offerText, budget, startDate, endDate, targetLocation, platforms, headline, description, templateId } = req.body

  if (!name || !budget || !startDate || !endDate || !platforms?.length) {
    res.status(400).json({ error: "Missing required fields: name, budget, startDate, endDate, platforms" })
    return
  }

  const accounts = await pool.query(
    "SELECT platform, access_token, refresh_token, platform_account_id FROM ad_accounts WHERE dealership_id = $1",
    [dealershipId]
  )
  const accountMap = Object.fromEntries(accounts.rows.map((a: any) => [a.platform, a]))

  const params = { name, budget: Number(budget), startDate, endDate, targetLocation, headline, description }

  let googleCampaignId: string | null = null
  let metaCampaignId: string | null = null

  try {
    if (platforms.includes("google") && accountMap.google) {
      const acc = accountMap.google
      googleCampaignId = await createGoogleCampaign(acc.access_token, acc.refresh_token, acc.platform_account_id, params)
    }

    if (platforms.includes("meta") && accountMap.meta) {
      const acc = accountMap.meta
      metaCampaignId = await createMetaCampaign(acc.access_token, acc.platform_account_id, params)
    }
  } catch (err: any) {
    // Rollback successful platform if the other failed
    if (googleCampaignId && accountMap.google) {
      try {
        const acc = accountMap.google
        await pauseGoogleCampaign(acc.access_token, acc.refresh_token, acc.platform_account_id, googleCampaignId)
      } catch { /* best effort */ }
    }
    res.status(502).json({ error: `Platform API error: ${err.message}` })
    return
  }

  const result = await pool.query(
    `INSERT INTO campaigns (dealership_id, name, template_type, car_model, offer_text, budget, start_date, end_date, target_location, platforms, google_campaign_id, meta_campaign_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
     RETURNING *`,
    [dealershipId, name, templateId ?? null, carModel ?? null, offerText ?? null, budget, startDate, endDate, targetLocation ?? null, platforms, googleCampaignId, metaCampaignId]
  )

  res.status(201).json(result.rows[0])
})

router.patch("/:id/pause", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { id } = req.params

  const campaign = await pool.query(
    "SELECT * FROM campaigns WHERE id = $1 AND dealership_id = $2",
    [id, dealershipId]
  )
  if (!campaign.rows[0]) { res.status(404).json({ error: "Campaign not found" }); return }

  const c = campaign.rows[0]
  const accounts = await pool.query(
    "SELECT platform, access_token, refresh_token, platform_account_id FROM ad_accounts WHERE dealership_id = $1",
    [dealershipId]
  )
  const accountMap = Object.fromEntries(accounts.rows.map((a: any) => [a.platform, a]))

  if (c.google_campaign_id && accountMap.google) {
    const acc = accountMap.google
    await pauseGoogleCampaign(acc.access_token, acc.refresh_token, acc.platform_account_id, c.google_campaign_id)
  }
  if (c.meta_campaign_id && accountMap.meta) {
    await setMetaCampaignStatus(accountMap.meta.access_token, c.meta_campaign_id, "PAUSED")
  }

  await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [id])
  res.json({ status: "paused" })
})

router.patch("/:id/resume", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { id } = req.params

  const campaign = await pool.query(
    "SELECT * FROM campaigns WHERE id = $1 AND dealership_id = $2",
    [id, dealershipId]
  )
  if (!campaign.rows[0]) { res.status(404).json({ error: "Campaign not found" }); return }

  const c = campaign.rows[0]
  const accounts = await pool.query(
    "SELECT platform, access_token, refresh_token, platform_account_id FROM ad_accounts WHERE dealership_id = $1",
    [dealershipId]
  )
  const accountMap = Object.fromEntries(accounts.rows.map((a: any) => [a.platform, a]))

  if (c.google_campaign_id && accountMap.google) {
    const acc = accountMap.google
    await resumeGoogleCampaign(acc.access_token, acc.refresh_token, acc.platform_account_id, c.google_campaign_id)
  }
  if (c.meta_campaign_id && accountMap.meta) {
    await setMetaCampaignStatus(accountMap.meta.access_token, c.meta_campaign_id, "ACTIVE")
  }

  await pool.query("UPDATE campaigns SET status = 'active' WHERE id = $1", [id])
  res.json({ status: "active" })
})

export default router
```

- [ ] **Step 4: Register router in app.ts**

Add to `backend/src/app.ts`:

```typescript
import campaignsRouter from "./routes/campaigns.js"
// ...existing imports...
app.use("/api/campaigns", campaignsRouter)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npm test routes/campaigns
```

Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/campaigns.ts backend/src/routes/campaigns.test.ts backend/src/app.ts
git commit -m "feat: add campaign CRUD routes with Google Ads and Meta API integration"
```

---

## Task 5: Wire Campaign List Frontend

**Files:**
- Modify: `frontend/app/dashboard/campaigns/page.tsx`

- [ ] **Step 1: Replace mock campaigns page**

Replace `frontend/app/dashboard/campaigns/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import Link from "next/link"
import { api } from "@/lib/api"

type StatusFilter = "all" | "active" | "paused" | "completed"

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const { data: campaigns, isLoading } = useSWR(
    `campaigns-${statusFilter}`,
    () => api.campaigns.list(statusFilter !== "all" ? statusFilter : undefined)
  )

  async function handleToggle(campaign: any) {
    const isPaused = campaign.status === "paused"
    if (!confirm(`${isPaused ? "Resume" : "Pause"} "${campaign.name}"?`)) return
    isPaused ? await api.campaigns.resume(campaign.id) : await api.campaigns.pause(campaign.id)
    mutate(`campaigns-${statusFilter}`)
  }

  const STATUS_TABS: StatusFilter[] = ["all", "active", "paused", "completed"]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <Link
          href="/dashboard/campaigns/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
        >
          + New Campaign
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-sm capitalize ${
              statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-gray-500 py-4">Loading...</div>}

      <div className="space-y-3">
        {(campaigns ?? []).map((c: any) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{c.name}</div>
              <div className="text-sm text-gray-500 mt-1">
                {c.platforms?.join(" + ")} ·{" "}
                ₹{Number(c.budget).toLocaleString("en-IN")} ·{" "}
                {c.start_date?.slice(0, 10)} to {c.end_date?.slice(0, 10)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                c.status === "active" ? "bg-green-100 text-green-700" :
                c.status === "paused" ? "bg-gray-100 text-gray-600" :
                "bg-blue-100 text-blue-700"
              }`}>
                {c.status}
              </span>
              {(c.status === "active" || c.status === "paused") && (
                <button
                  onClick={() => handleToggle(c)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {c.status === "active" ? "Pause" : "Resume"}
                </button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && (!campaigns || campaigns.length === 0) && (
          <div className="text-gray-400 py-8 text-center">No campaigns yet.</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/campaigns/page.tsx
git commit -m "feat: wire campaigns list page to real API with pause/resume"
```

---

## Task 6: New Campaign Flow — Template Picker

**Files:**
- Create: `frontend/app/dashboard/campaigns/new/page.tsx`

- [ ] **Step 1: Create template picker page**

Create `frontend/app/dashboard/campaigns/new/page.tsx`:

```tsx
"use client"

import useSWR from "swr"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

export default function NewCampaignPage() {
  const router = useRouter()
  const { data: templates, isLoading } = useSWR("templates", api.campaigns.templates)

  if (isLoading) return <div className="p-8 text-gray-500">Loading templates...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose a Template</h1>
      <p className="text-gray-500 mb-6">Pick a template to pre-fill your campaign</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(templates ?? []).map((t: any) => (
          <button
            key={t.id}
            onClick={() => router.push(`/dashboard/campaigns/new/${t.id}`)}
            className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div
              className="w-10 h-10 rounded-lg mb-3 flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: t.thumbnailColor }}
            >
              {t.name.charAt(0)}
            </div>
            {t.mostUsed && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full mb-2 inline-block">
                Most Used
              </span>
            )}
            <div className="font-semibold text-gray-900">{t.name}</div>
            <div className="text-sm text-gray-500 mt-1">{t.useCase}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/campaigns/new/page.tsx
git commit -m "feat: add campaign template picker page"
```

---

## Task 7: New Campaign Flow — 3-Step Form

**Files:**
- Create: `frontend/app/dashboard/campaigns/new/[templateId]/page.tsx`

- [ ] **Step 1: Create the 3-step campaign form**

Create `frontend/app/dashboard/campaigns/new/[templateId]/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { api } from "@/lib/api"

type Step = 1 | 2 | 3

interface FormState {
  carModel: string
  offerText: string
  headline: string
  description: string
  budget: string
  startDate: string
  endDate: string
  targetLocation: string
  platforms: string[]
}

function substituteTemplate(template: string, carModel: string) {
  return template.replace(/\{\{carModel\}\}/g, carModel)
}

export default function CampaignFormPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [createdCampaign, setCreatedCampaign] = useState<any>(null)

  const { data: templates } = useSWR("templates", api.campaigns.templates)
  const template = templates?.find((t: any) => t.id === templateId)

  const [form, setForm] = useState<FormState>({
    carModel: "",
    offerText: "",
    headline: template?.headline ?? "",
    description: template?.description ?? "",
    budget: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    targetLocation: "",
    platforms: ["google", "meta"],
  })

  function updateField(field: keyof FormState, value: any) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "carModel") {
        next.headline = substituteTemplate(template?.headline ?? "", value)
      }
      return next
    })
  }

  async function handlePublish() {
    setSubmitting(true)
    setError("")
    try {
      const campaign = await api.campaigns.create({
        name: `${form.carModel} ${template?.name ?? "Campaign"}`,
        templateId,
        carModel: form.carModel,
        offerText: form.offerText,
        budget: Number(form.budget),
        startDate: form.startDate,
        endDate: form.endDate,
        targetLocation: form.targetLocation,
        platforms: form.platforms,
        headline: form.headline,
        description: form.description,
      })
      setCreatedCampaign(campaign)
      setStep(3)
    } catch (err: any) {
      setError(err.message ?? "Failed to create campaign")
    } finally {
      setSubmitting(false)
    }
  }

  if (!template) return <div className="p-8 text-gray-500">Loading...</div>

  // Step 3: Confirmation
  if (step === 3 && createdCampaign) {
    return (
      <div className="p-8 max-w-lg">
        <div className="text-green-600 text-4xl mb-4">✓</div>
        <h2 className="text-2xl font-bold mb-2">Campaign Live!</h2>
        <p className="text-gray-600 mb-4">Your campaign has been published to {createdCampaign.platforms?.join(" and ")}.</p>
        <div className="bg-gray-50 rounded p-4 text-sm mb-6">
          <div><span className="text-gray-500">Campaign ID:</span> {createdCampaign.id}</div>
          <div><span className="text-gray-500">Budget:</span> ₹{Number(createdCampaign.budget).toLocaleString("en-IN")}/month</div>
        </div>
        <button
          onClick={() => router.push("/dashboard/campaigns")}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          View All Campaigns
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Step indicator */}
      <div className="flex gap-4 mb-8">
        {[["1", "Details"], ["2", "Preview"], ["3", "Publish"]].map(([n, label]) => (
          <div key={n} className={`flex items-center gap-2 text-sm ${Number(n) === step ? "font-semibold text-blue-600" : "text-gray-400"}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${Number(n) === step ? "bg-blue-600 text-white" : "bg-gray-200"}`}>{n}</span>
            {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">{template.name} — Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Car Model *</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. Maruti Swift"
              value={form.carModel}
              onChange={(e) => updateField("carModel", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offer Text</label>
            <input
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="e.g. Free test drive this weekend"
              value={form.offerText}
              onChange={(e) => updateField("offerText", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹/month) *</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="5000"
                value={form.budget}
                onChange={(e) => updateField("budget", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Location *</label>
              <input
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="e.g. Pune"
                value={form.targetLocation}
                onChange={(e) => updateField("targetLocation", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={form.startDate} onChange={(e) => updateField("startDate", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" value={form.endDate} onChange={(e) => updateField("endDate", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platforms</label>
            <div className="flex gap-3">
              {["google", "meta"].map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.platforms.includes(p)}
                    onChange={(e) => {
                      updateField("platforms", e.target.checked
                        ? [...form.platforms, p]
                        : form.platforms.filter((x) => x !== p))
                    }}
                  />
                  <span className="capitalize">{p === "google" ? "Google Ads" : "Meta Ads"}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!form.carModel || !form.budget || !form.targetLocation || form.platforms.length === 0}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Preview →
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold mb-6">Preview Your Ads</h2>

          {form.platforms.includes("google") && (
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-400 uppercase mb-2">Google Search Ad</div>
              <div className="text-blue-700 font-medium">{form.headline}</div>
              <div className="text-green-700 text-sm">www.yourdealership.com › cars</div>
              <div className="text-sm text-gray-600 mt-1">{form.description}</div>
            </div>
          )}

          {form.platforms.includes("meta") && (
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-400 uppercase mb-2">Meta Feed Ad</div>
              <div className="bg-gray-100 rounded h-32 flex items-center justify-center text-gray-400 text-sm mb-3">
                Image Placeholder
              </div>
              <div className="font-medium text-gray-900">{form.headline}</div>
              <div className="text-sm text-gray-600 mt-1">{form.description}</div>
              <div className="mt-2 text-blue-600 text-sm font-medium">{template.cta} →</div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-300 rounded text-sm">← Edit</button>
            <button onClick={() => setStep(3)} className="px-6 py-2 bg-blue-600 text-white rounded text-sm">Looks Good →</button>
          </div>
        </div>
      )}

      {step === 3 && !createdCampaign && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Ready to Go Live</h2>
          <div className="bg-gray-50 rounded p-4 text-sm mb-6 space-y-2">
            <div><span className="text-gray-500">Campaign:</span> {form.carModel} {template.name}</div>
            <div><span className="text-gray-500">Budget:</span> ₹{Number(form.budget).toLocaleString("en-IN")}/month</div>
            <div><span className="text-gray-500">Duration:</span> {form.startDate} → {form.endDate}</div>
            <div><span className="text-gray-500">Location:</span> {form.targetLocation}</div>
            <div><span className="text-gray-500">Platforms:</span> {form.platforms.join(", ")}</div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 border border-gray-300 rounded text-sm">← Back</button>
            <button
              onClick={handlePublish}
              disabled={submitting}
              className="px-8 py-2 bg-green-600 text-white rounded font-medium disabled:opacity-50"
            >
              {submitting ? "Publishing..." : "Go Live 🚀"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/campaigns/new/
git commit -m "feat: add 3-step campaign creation form with template prefill and publish"
```

---

**Phase 2b complete when:** Template picker loads 5 templates, full creation flow works end-to-end with sandbox APIs, campaign appears in list, pause/resume updates both DB and platform.
