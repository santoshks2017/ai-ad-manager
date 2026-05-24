# Phase 2a: Dashboard & Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real Google Ads and Meta Ads metric adapters, populate the metrics_cache table every 15 minutes, implement the dashboard API endpoints, and wire the frontend dashboard to live data with date filtering and WoW deltas.

**Architecture:** Two platform adapters each return a `NormalizedMetric[]` array. An aggregation service merges them and computes totals. A node-cron job calls both adapters every 15 minutes and upserts into metrics_cache. The dashboard route reads only from metrics_cache (never calls external APIs directly), making it fast and offline-tolerant.

**Tech Stack:** googleapis, axios, node-cron, swr (frontend), vitest, supertest

**Entry condition:** Phase 1 complete — users can log in and at least one sandbox ad account is connected.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/services/google-ads.ts` | GAQL metric fetch → NormalizedMetric[] |
| Create | `backend/src/services/meta-ads.ts` | Graph API metric fetch → NormalizedMetric[] |
| Create | `backend/src/services/metrics-aggregator.ts` | Merge platforms, compute KPIs + deltas |
| Create | `backend/src/cron/sync-metrics.ts` | 15-min cron: fetch → upsert metrics_cache |
| Modify | `backend/src/routes/dashboard.ts` | Implement /metrics and /campaigns/top |
| Modify | `backend/src/app.ts` | Register cron on startup |
| Create | `backend/src/services/google-ads.test.ts` | Unit tests for GAQL normalizer |
| Create | `backend/src/services/metrics-aggregator.test.ts` | Unit tests for aggregation math |
| Create | `backend/src/routes/dashboard.test.ts` | API integration tests |
| Modify | `frontend/app/dashboard/page.tsx` | Wire useSWR, date filter, WoW arrows |

---

## Shared Types

Create `backend/src/types.ts` (used across all phases):

```typescript
export interface NormalizedMetric {
  platform: "google" | "meta"
  campaignId: string
  campaignName: string
  date: string        // YYYY-MM-DD
  spend: number       // INR
  impressions: number
  clicks: number
  leads: number
}
```

---

## Task 1: Create Shared Types File

**Files:**
- Create: `backend/src/types.ts`

- [ ] **Step 1: Create shared types**

Create `backend/src/types.ts`:

```typescript
export interface NormalizedMetric {
  platform: "google" | "meta"
  campaignId: string
  campaignName: string
  date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
}

export interface NormalizedLead {
  platformLeadId: string
  platform: "google" | "meta"
  campaignId: string
  name: string
  phone: string
  email: string
  receivedAt: string
}

export interface DashboardMetrics {
  totalSpend: number
  totalLeads: number
  costPerLead: number
  activeCampaigns: number
  platformBreakdown: {
    google: { spend: number; leads: number }
    meta: { spend: number; leads: number }
  }
  leadsTimeSeries: Array<{ date: string; leads: number }>
  deltas: {
    spend: number
    leads: number
    cpl: number
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 2: Google Ads Metrics Adapter

**Files:**
- Create: `backend/src/services/google-ads.ts`
- Create: `backend/src/services/google-ads.test.ts`

- [ ] **Step 1: Write failing unit test for the response normalizer**

Create `backend/src/services/google-ads.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { normalizeGoogleMetrics } from "./google-ads.js"

describe("normalizeGoogleMetrics", () => {
  it("converts micros spend to INR and maps fields", () => {
    const raw = [
      {
        campaign: { id: "123", name: "Swift Launch" },
        metrics: {
          costMicros: "50000000",  // 50 INR
          impressions: "1000",
          clicks: "50",
          conversions: "5",
        },
        segments: { date: "2026-05-20" },
      },
    ]
    const result = normalizeGoogleMetrics(raw)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      platform: "google",
      campaignId: "123",
      campaignName: "Swift Launch",
      date: "2026-05-20",
      spend: 50,
      impressions: 1000,
      clicks: 50,
      leads: 5,
    })
  })

  it("returns empty array for empty input", () => {
    expect(normalizeGoogleMetrics([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test google-ads
```

Expected: FAIL — `Cannot find module './google-ads.js'`

- [ ] **Step 3: Implement the adapter**

Create `backend/src/services/google-ads.ts`:

```typescript
import { google } from "googleapis"
import type { NormalizedMetric } from "../types.js"
import { decryptToken } from "./token-store.js"

export function normalizeGoogleMetrics(rows: any[]): NormalizedMetric[] {
  return rows.map((row) => ({
    platform: "google" as const,
    campaignId: String(row.campaign?.id ?? ""),
    campaignName: String(row.campaign?.name ?? ""),
    date: String(row.segments?.date ?? ""),
    spend: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
    impressions: Number(row.metrics?.impressions ?? 0),
    clicks: Number(row.metrics?.clicks ?? 0),
    leads: Number(row.metrics?.conversions ?? 0),
  }))
}

export async function fetchGoogleMetrics(
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  customerId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedMetric[]> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ADS_CLIENT_ID,
    process.env.GOOGLE_ADS_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: decryptToken(encryptedAccessToken),
    refresh_token: encryptedRefreshToken ? decryptToken(encryptedRefreshToken) : undefined,
  })

  try {
    const adsClient = google.ads({ version: "v17", auth: oauth2Client })
    const gaql = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status = 'ENABLED'
    `
    const response = await adsClient.customers.googleAds.search({
      customerId,
      requestBody: { query: gaql },
    })
    return normalizeGoogleMetrics(response.data.results ?? [])
  } catch (err) {
    console.error("Google Ads API error:", err)
    return []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test google-ads
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/google-ads.ts backend/src/services/google-ads.test.ts
git commit -m "feat: add Google Ads metrics adapter with GAQL normalizer"
```

---

## Task 3: Meta Ads Metrics Adapter

**Files:**
- Create: `backend/src/services/meta-ads.ts`
- Create: `backend/src/services/meta-ads.test.ts`

- [ ] **Step 1: Write failing unit test**

Create `backend/src/services/meta-ads.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { normalizeMetaMetrics } from "./meta-ads.js"

describe("normalizeMetaMetrics", () => {
  it("maps Meta insights fields to NormalizedMetric", () => {
    const raw = [
      {
        campaign_id: "456",
        campaign_name: "Creta Test Drive",
        date_start: "2026-05-20",
        spend: "1200.50",
        impressions: "8000",
        clicks: "320",
        actions: [{ action_type: "lead", value: "12" }],
      },
    ]
    const result = normalizeMetaMetrics(raw)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      platform: "meta",
      campaignId: "456",
      campaignName: "Creta Test Drive",
      date: "2026-05-20",
      spend: 1200.50,
      impressions: 8000,
      clicks: 320,
      leads: 12,
    })
  })

  it("returns 0 leads when no lead action present", () => {
    const raw = [
      {
        campaign_id: "789",
        campaign_name: "No Leads",
        date_start: "2026-05-20",
        spend: "500",
        impressions: "2000",
        clicks: "100",
        actions: [{ action_type: "link_click", value: "100" }],
      },
    ]
    const result = normalizeMetaMetrics(raw)
    expect(result[0].leads).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test meta-ads
```

Expected: FAIL — `Cannot find module './meta-ads.js'`

- [ ] **Step 3: Implement the adapter**

Create `backend/src/services/meta-ads.ts`:

```typescript
import axios from "axios"
import type { NormalizedMetric } from "../types.js"
import { decryptToken } from "./token-store.js"

export function normalizeMetaMetrics(insights: any[]): NormalizedMetric[] {
  return insights.map((insight) => {
    const leadAction = (insight.actions ?? []).find(
      (a: any) => a.action_type === "lead"
    )
    return {
      platform: "meta" as const,
      campaignId: String(insight.campaign_id ?? ""),
      campaignName: String(insight.campaign_name ?? ""),
      date: String(insight.date_start ?? ""),
      spend: parseFloat(insight.spend ?? "0"),
      impressions: parseInt(insight.impressions ?? "0", 10),
      clicks: parseInt(insight.clicks ?? "0", 10),
      leads: leadAction ? parseInt(leadAction.value, 10) : 0,
    }
  })
}

export async function fetchMetaMetrics(
  encryptedAccessToken: string,
  adAccountId: string,
  startDate: string,
  endDate: string
): Promise<NormalizedMetric[]> {
  const accessToken = decryptToken(encryptedAccessToken)
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/act_${adAccountId}/insights`,
      {
        params: {
          access_token: accessToken,
          fields: "campaign_id,campaign_name,spend,impressions,clicks,actions",
          time_range: JSON.stringify({ since: startDate, until: endDate }),
          time_increment: 1,
          level: "campaign",
          limit: 500,
        },
      }
    )
    return normalizeMetaMetrics(response.data.data ?? [])
  } catch (err) {
    console.error("Meta Ads API error:", err)
    return []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test meta-ads
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/meta-ads.ts backend/src/services/meta-ads.test.ts
git commit -m "feat: add Meta Ads metrics adapter with Graph API normalizer"
```

---

## Task 4: Metrics Aggregation Service

**Files:**
- Create: `backend/src/services/metrics-aggregator.ts`
- Create: `backend/src/services/metrics-aggregator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/services/metrics-aggregator.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { aggregateMetrics, computeWoWDelta } from "./metrics-aggregator.js"
import type { NormalizedMetric } from "../types.js"

const makeMetric = (overrides: Partial<NormalizedMetric> = {}): NormalizedMetric => ({
  platform: "google",
  campaignId: "1",
  campaignName: "Test",
  date: "2026-05-20",
  spend: 1000,
  impressions: 5000,
  clicks: 200,
  leads: 10,
  ...overrides,
})

describe("aggregateMetrics", () => {
  it("sums spend and leads across platforms", () => {
    const metrics = [
      makeMetric({ platform: "google", spend: 1000, leads: 10 }),
      makeMetric({ platform: "meta", spend: 2000, leads: 20 }),
    ]
    const result = aggregateMetrics(metrics)
    expect(result.totalSpend).toBe(3000)
    expect(result.totalLeads).toBe(30)
  })

  it("computes CPL as spend / leads", () => {
    const metrics = [makeMetric({ spend: 3000, leads: 10 })]
    const result = aggregateMetrics(metrics)
    expect(result.costPerLead).toBe(300)
  })

  it("returns 0 CPL when no leads", () => {
    const metrics = [makeMetric({ leads: 0, spend: 1000 })]
    const result = aggregateMetrics(metrics)
    expect(result.costPerLead).toBe(0)
  })

  it("builds platform breakdown correctly", () => {
    const metrics = [
      makeMetric({ platform: "google", spend: 1000, leads: 5 }),
      makeMetric({ platform: "meta", spend: 2000, leads: 15 }),
    ]
    const result = aggregateMetrics(metrics)
    expect(result.platformBreakdown.google).toEqual({ spend: 1000, leads: 5 })
    expect(result.platformBreakdown.meta).toEqual({ spend: 2000, leads: 15 })
  })
})

describe("computeWoWDelta", () => {
  it("returns positive delta when current > previous", () => {
    expect(computeWoWDelta(120, 100)).toBeCloseTo(20)
  })

  it("returns negative delta when current < previous", () => {
    expect(computeWoWDelta(80, 100)).toBeCloseTo(-20)
  })

  it("returns 0 when previous is 0", () => {
    expect(computeWoWDelta(100, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test metrics-aggregator
```

Expected: FAIL — `Cannot find module './metrics-aggregator.js'`

- [ ] **Step 3: Implement the aggregator**

Create `backend/src/services/metrics-aggregator.ts`:

```typescript
import type { NormalizedMetric, DashboardMetrics } from "../types.js"

export function computeWoWDelta(current: number, previous: number): number {
  if (previous === 0) return 0
  return parseFloat((((current - previous) / previous) * 100).toFixed(1))
}

export function aggregateMetrics(
  metrics: NormalizedMetric[],
  previousMetrics?: NormalizedMetric[]
): DashboardMetrics {
  const totalSpend = metrics.reduce((sum, m) => sum + m.spend, 0)
  const totalLeads = metrics.reduce((sum, m) => sum + m.leads, 0)
  const costPerLead = totalLeads > 0 ? parseFloat((totalSpend / totalLeads).toFixed(2)) : 0

  const platformBreakdown = {
    google: {
      spend: metrics.filter((m) => m.platform === "google").reduce((s, m) => s + m.spend, 0),
      leads: metrics.filter((m) => m.platform === "google").reduce((s, m) => s + m.leads, 0),
    },
    meta: {
      spend: metrics.filter((m) => m.platform === "meta").reduce((s, m) => s + m.spend, 0),
      leads: metrics.filter((m) => m.platform === "meta").reduce((s, m) => s + m.leads, 0),
    },
  }

  // Build leads time series grouped by date
  const dateMap = new Map<string, number>()
  for (const m of metrics) {
    dateMap.set(m.date, (dateMap.get(m.date) ?? 0) + m.leads)
  }
  const leadsTimeSeries = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, leads]) => ({ date, leads }))

  let deltas = { spend: 0, leads: 0, cpl: 0 }
  if (previousMetrics && previousMetrics.length > 0) {
    const prevSpend = previousMetrics.reduce((s, m) => s + m.spend, 0)
    const prevLeads = previousMetrics.reduce((s, m) => s + m.leads, 0)
    const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : 0
    deltas = {
      spend: computeWoWDelta(totalSpend, prevSpend),
      leads: computeWoWDelta(totalLeads, prevLeads),
      cpl: computeWoWDelta(costPerLead, prevCpl),
    }
  }

  return {
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    totalLeads,
    costPerLead,
    activeCampaigns: 0, // set by the route from DB
    platformBreakdown,
    leadsTimeSeries,
    deltas,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test metrics-aggregator
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/metrics-aggregator.ts backend/src/services/metrics-aggregator.test.ts
git commit -m "feat: add metrics aggregation service with WoW delta computation"
```

---

## Task 5: Metrics Cache Cron

**Files:**
- Create: `backend/src/cron/sync-metrics.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Install node-cron**

```bash
cd backend && npm install node-cron && npm install -D @types/node-cron
```

- [ ] **Step 2: Create the cron job**

Create `backend/src/cron/sync-metrics.ts`:

```typescript
import cron from "node-cron"
import { pool } from "../db.js"
import { fetchGoogleMetrics } from "../services/google-ads.js"
import { fetchMetaMetrics } from "../services/meta-ads.js"

function dateRange(daysBack: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - daysBack)
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

async function syncMetricsForDealership(
  dealershipId: string,
  startDate: string,
  endDate: string
) {
  const accountsResult = await pool.query(
    "SELECT platform, access_token, refresh_token, platform_account_id FROM ad_accounts WHERE dealership_id = $1",
    [dealershipId]
  )

  for (const account of accountsResult.rows) {
    let metrics = []

    if (account.platform === "google") {
      metrics = await fetchGoogleMetrics(
        account.access_token,
        account.refresh_token,
        account.platform_account_id,
        startDate,
        endDate
      )
    } else if (account.platform === "meta") {
      metrics = await fetchMetaMetrics(
        account.access_token,
        account.platform_account_id,
        startDate,
        endDate
      )
    }

    for (const m of metrics) {
      const cpl = m.leads > 0 ? m.spend / m.leads : 0
      await pool.query(
        `INSERT INTO metrics_cache (dealership_id, platform, date, spend, impressions, clicks, leads, cpl)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (dealership_id, platform, date) DO UPDATE
         SET spend = EXCLUDED.spend, impressions = EXCLUDED.impressions,
             clicks = EXCLUDED.clicks, leads = EXCLUDED.leads, cpl = EXCLUDED.cpl,
             cached_at = NOW()`,
        [dealershipId, m.platform, m.date, m.spend, m.impressions, m.clicks, m.leads, cpl]
      )
    }
  }
}

export async function syncAllMetrics() {
  const { start, end } = dateRange(35) // 35 days back for WoW comparisons
  const dealerships = await pool.query("SELECT DISTINCT dealership_id FROM ad_accounts")
  await Promise.all(
    dealerships.rows.map((row) => syncMetricsForDealership(row.dealership_id, start, end))
  )
  console.log(`[sync-metrics] Synced at ${new Date().toISOString()}`)
}

export function startMetricsSyncCron() {
  // Every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    syncAllMetrics().catch(console.error)
  })
  console.log("[sync-metrics] Cron started — runs every 15 minutes")
}
```

- [ ] **Step 3: Start the cron on server boot**

Modify `backend/src/index.ts`:

```typescript
import dotenv from "dotenv"
import app from "./app.js"
import { startMetricsSyncCron } from "./cron/sync-metrics.js"

dotenv.config()

const port = Number(process.env.PORT ?? 4000)

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`)
  startMetricsSyncCron()
})
```

- [ ] **Step 4: Restart server and verify cron log**

```bash
cd backend && npm run dev
```

Expected output includes: `[sync-metrics] Cron started — runs every 15 minutes`

- [ ] **Step 5: Commit**

```bash
git add backend/src/cron/sync-metrics.ts backend/src/index.ts
git commit -m "feat: add 15-minute metrics cache sync cron"
```

---

## Task 6: Dashboard API Routes

**Files:**
- Modify: `backend/src/routes/dashboard.ts`
- Create: `backend/src/routes/dashboard.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing API tests**

Create `backend/src/routes/dashboard.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import { testPool } from "../test/setup.js"
import { clearTables, seedDealership, seedUser } from "../test/helpers.js"
import app from "../app.js"

const SECRET = "local-dev-secret-change-in-prod-32chars"
process.env.NEXTAUTH_SECRET = SECRET
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test"

function makeToken(userId: string, dealershipId: string) {
  return jwt.sign({ userId, dealershipId }, SECRET, { algorithm: "HS256" })
}

async function seedMetrics(dealershipId: string) {
  await testPool.query(`
    INSERT INTO metrics_cache (dealership_id, platform, date, spend, impressions, clicks, leads, cpl)
    VALUES
      ($1, 'google', '2026-05-18', 1000, 5000, 200, 10, 100),
      ($1, 'meta',   '2026-05-18', 2000, 8000, 300, 20, 100),
      ($1, 'google', '2026-05-11', 800,  4000, 150,  8, 100),
      ($1, 'meta',   '2026-05-11', 1600, 6000, 240, 16, 100)
  `, [dealershipId])
}

describe("GET /api/dashboard/metrics", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    await seedMetrics(dealership.id)
  })

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/dashboard/metrics")
    expect(res.status).toBe(401)
  })

  it("returns aggregated metrics for week period", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/dashboard/metrics?period=week")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.totalSpend).toBeGreaterThan(0)
    expect(res.body.totalLeads).toBeGreaterThan(0)
    expect(res.body.platformBreakdown).toHaveProperty("google")
    expect(res.body.platformBreakdown).toHaveProperty("meta")
    expect(res.body.deltas).toHaveProperty("spend")
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test routes/dashboard
```

Expected: FAIL — returns hardcoded zeros

- [ ] **Step 3: Implement the dashboard routes**

Replace `backend/src/routes/dashboard.ts`:

```typescript
import express from "express"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { aggregateMetrics } from "../services/metrics-aggregator.js"
import type { NormalizedMetric } from "../types.js"

const router = express.Router()

function getPeriodDates(period: string, from?: string, to?: string): { start: string; end: string } {
  const now = new Date()
  const today = now.toISOString().split("T")[0]

  if (period === "custom" && from && to) return { start: from, end: to }

  if (period === "today") return { start: today, end: today }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    return { start, end: today }
  }

  // default: week (last 7 days)
  const start = new Date()
  start.setDate(start.getDate() - 6)
  return { start: start.toISOString().split("T")[0], end: today }
}

function getPreviousPeriodDates(start: string, end: string): { start: string; end: string } {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const prevEnd = new Date(startDate.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - diffMs)
  return {
    start: prevStart.toISOString().split("T")[0],
    end: prevEnd.toISOString().split("T")[0],
  }
}

function rowsToMetrics(rows: any[]): NormalizedMetric[] {
  return rows.map((r) => ({
    platform: r.platform as "google" | "meta",
    campaignId: "",
    campaignName: "",
    date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
    spend: parseFloat(r.spend),
    impressions: parseInt(r.impressions),
    clicks: parseInt(r.clicks),
    leads: parseInt(r.leads),
  }))
}

router.get("/metrics", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { period = "week", from, to } = req.query as Record<string, string>

  const { start, end } = getPeriodDates(period, from, to)
  const prev = getPreviousPeriodDates(start, end)

  const [currentRows, previousRows, activeCount] = await Promise.all([
    pool.query(
      "SELECT platform, date, spend, impressions, clicks, leads FROM metrics_cache WHERE dealership_id = $1 AND date BETWEEN $2 AND $3",
      [dealershipId, start, end]
    ),
    pool.query(
      "SELECT platform, date, spend, impressions, clicks, leads FROM metrics_cache WHERE dealership_id = $1 AND date BETWEEN $2 AND $3",
      [dealershipId, prev.start, prev.end]
    ),
    pool.query(
      "SELECT COUNT(*) FROM campaigns WHERE dealership_id = $1 AND status = 'active'",
      [dealershipId]
    ),
  ])

  const metrics = aggregateMetrics(rowsToMetrics(currentRows.rows), rowsToMetrics(previousRows.rows))
  metrics.activeCampaigns = parseInt(activeCount.rows[0].count)

  res.json(metrics)
})

router.get("/campaigns/top", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { period = "week", from, to } = req.query as Record<string, string>
  const { start, end } = getPeriodDates(period, from, to)

  const result = await pool.query(
    `SELECT c.id, c.name, c.platforms, SUM(mc.leads) as total_leads, SUM(mc.spend) as total_spend
     FROM campaigns c
     JOIN metrics_cache mc ON mc.dealership_id = c.dealership_id
     WHERE c.dealership_id = $1 AND mc.date BETWEEN $2 AND $3
     GROUP BY c.id, c.name, c.platforms
     ORDER BY total_leads DESC
     LIMIT 1`,
    [dealershipId, start, end]
  )

  res.json(result.rows[0] ?? null)
})

export default router
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test routes/dashboard
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/dashboard.ts backend/src/routes/dashboard.test.ts
git commit -m "feat: implement dashboard metrics and top-campaign API endpoints"
```

---

## Task 7: Wire Frontend Dashboard

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Install swr**

```bash
cd frontend && npm install swr
```

- [ ] **Step 2: Replace mock dashboard page**

Replace `frontend/app/dashboard/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import useSWR from "swr"
import { api } from "@/lib/api"

type Period = "today" | "week" | "month"

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return null
  const positive = value > 0
  return (
    <span className={`text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
      {positive ? "↑" : "↓"} {Math.abs(value)}%
    </span>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("week")

  const { data: metrics, isLoading } = useSWR(
    `dashboard-metrics-${period}`,
    () => api.dashboard.metrics(`period=${period}`)
  )

  const { data: topCampaign } = useSWR(
    `dashboard-top-${period}`,
    () => api.dashboard.topCampaign(`period=${period}`)
  )

  const kpis = [
    {
      label: "Total Spend",
      value: metrics ? `₹${metrics.totalSpend.toLocaleString("en-IN")}` : "—",
      delta: metrics?.deltas?.spend ?? 0,
    },
    {
      label: "Total Leads",
      value: metrics?.totalLeads ?? "—",
      delta: metrics?.deltas?.leads ?? 0,
    },
    {
      label: "Cost Per Lead",
      value: metrics ? `₹${metrics.costPerLead.toLocaleString("en-IN")}` : "—",
      delta: metrics?.deltas?.cpl ?? 0,
    },
    {
      label: "Active Campaigns",
      value: metrics?.activeCampaigns ?? "—",
      delta: 0,
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-2">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="text-gray-500 py-8">Loading metrics...</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-500">{kpi.label}</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</div>
              <DeltaBadge value={kpi.delta} />
            </div>
          ))}
        </div>
      )}

      {/* Platform Split */}
      {metrics && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Platform Split (Spend)</div>
          <div className="flex gap-4 text-sm">
            <span className="text-blue-600">
              Google: ₹{metrics.platformBreakdown.google.spend.toLocaleString("en-IN")}
            </span>
            <span className="text-indigo-600">
              Meta: ₹{metrics.platformBreakdown.meta.spend.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      {/* Top Campaign */}
      {topCampaign && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-700 mb-1">Top Campaign</div>
          <div className="font-semibold text-gray-900">{topCampaign.name}</div>
          <div className="text-sm text-gray-500 mt-1">
            {topCampaign.total_leads} leads · ₹{Number(topCampaign.total_spend).toLocaleString("en-IN")} spend
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manually verify dashboard**

```bash
# Ensure both servers running
# Seed some test metrics via psql if needed:
psql -U postgres -d ai_ad_manager_dev -c "
  INSERT INTO metrics_cache (dealership_id, platform, date, spend, impressions, clicks, leads, cpl)
  SELECT d.id, 'google', CURRENT_DATE - n, 1000*n, 5000, 200, 10, 100
  FROM dealerships d, generate_series(1, 7) n
  ON CONFLICT DO NOTHING;
"
```

Open http://localhost:3000/dashboard — verify KPI cards populate, period switcher updates values.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/page.tsx frontend/package.json
git commit -m "feat: wire dashboard to live API with date filter and WoW deltas"
```

---

**Phase 2a complete when:** Dashboard shows real metrics from metrics_cache, date period filter works, WoW deltas display correctly, cron log shows every 15 minutes.
