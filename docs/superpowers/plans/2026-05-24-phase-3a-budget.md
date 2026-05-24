# Phase 3a: Budget Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement monthly budget caps per platform, a 15-minute spend monitoring cron that fires alerts at 75% and 95% threshold crossings exactly once per month, stub email/SMS services, and wire the budget manager frontend with real-time progress bars and pause-all functionality.

**Architecture:** Budget settings are stored per (dealership, platform). The monitoring cron reads current month spend from metrics_cache, compares to cap, and fires alerts only when a threshold is newly crossed (tracked via `alert_75_sent_at` / `alert_95_sent_at` timestamps on the budget_settings row). Email and SMS are console/file stubs locally, but implement the same interface as SendGrid/MSG91 so swapping is a one-line change.

**Tech Stack:** node-cron, vitest, supertest

**Entry condition:** Phases 1 + 2 complete — campaigns running, metrics_cache populated with spend data.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/db/migrations/001_budget_alert_timestamps.sql` | Add alert tracking columns to budget_settings |
| Create | `backend/src/routes/budget.ts` | Budget CRUD routes |
| Create | `backend/src/services/email.ts` | Console-stub email service |
| Create | `backend/src/services/sms.ts` | Console-stub SMS service |
| Create | `backend/src/services/alert-service.ts` | Threshold detection + alert dispatch |
| Create | `backend/src/services/alert-service.test.ts` | Unit tests for threshold logic |
| Create | `backend/src/cron/monitor-budget.ts` | 15-min spend monitor + monthly reset |
| Create | `backend/src/routes/budget.test.ts` | API integration tests |
| Modify | `backend/src/app.ts` | Register budget router |
| Modify | `backend/src/index.ts` | Start budget cron |
| Modify | `frontend/app/dashboard/budget/page.tsx` | Wire real data |

---

## Task 1: Schema Migration — Alert Tracking Columns

**Files:**
- Create: `backend/src/db/migrations/001_budget_alert_timestamps.sql`

- [ ] **Step 1: Create migration file**

Create `backend/src/db/migrations/001_budget_alert_timestamps.sql`:

```sql
ALTER TABLE budget_settings
  ADD COLUMN IF NOT EXISTS alert_75_sent_at  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS alert_95_sent_at  TIMESTAMP WITH TIME ZONE;
```

- [ ] **Step 2: Run migration against both databases**

```bash
psql -U postgres -d ai_ad_manager_dev -f backend/src/db/migrations/001_budget_alert_timestamps.sql
psql -U postgres -d ai_ad_manager_test -f backend/src/db/migrations/001_budget_alert_timestamps.sql
```

Expected: `ALTER TABLE` (twice)

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/001_budget_alert_timestamps.sql
git commit -m "feat: add alert timestamp columns to budget_settings"
```

---

## Task 2: Email and SMS Stub Services

**Files:**
- Create: `backend/src/services/email.ts`
- Create: `backend/src/services/sms.ts`

- [ ] **Step 1: Create email stub**

Create `backend/src/services/email.ts`:

```typescript
export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  // LOCAL STUB — replace with SendGrid in production:
  // const sgMail = require('@sendgrid/mail')
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  // await sgMail.send({ from: 'noreply@yourdomain.com', ...payload })
  console.log(`[email] To: ${payload.to} | Subject: ${payload.subject}`)
  console.log(`[email] Body: ${payload.html.replace(/<[^>]+>/g, " ").slice(0, 200)}...`)
}
```

- [ ] **Step 2: Create SMS stub**

Create `backend/src/services/sms.ts`:

```typescript
export interface SmsPayload {
  to: string    // Phone number with country code
  message: string
}

export async function sendSms(payload: SmsPayload): Promise<void> {
  // LOCAL STUB — replace with MSG91 in production:
  // const msg91 = axios.post('https://api.msg91.com/api/sendhttp.php', {...})
  console.log(`[sms] To: ${payload.to} | Message: ${payload.message}`)
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/email.ts backend/src/services/sms.ts
git commit -m "feat: add console-stub email and SMS services (SendGrid/MSG91 interface)"
```

---

## Task 3: Alert Service

**Files:**
- Create: `backend/src/services/alert-service.ts`
- Create: `backend/src/services/alert-service.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `backend/src/services/alert-service.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  shouldSendAlert,
  computeProjectedMonthEnd,
} from "./alert-service.js"

describe("shouldSendAlert", () => {
  it("returns true when threshold newly crossed and not sent this month", () => {
    expect(shouldSendAlert(76, 75, null)).toBe(true)
  })

  it("returns false when already sent this month", () => {
    const sentAt = new Date()  // sent today = this month
    expect(shouldSendAlert(76, 75, sentAt)).toBe(false)
  })

  it("returns false when below threshold", () => {
    expect(shouldSendAlert(70, 75, null)).toBe(false)
  })

  it("returns true when sent last month (different calendar month)", () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    expect(shouldSendAlert(76, 75, lastMonth)).toBe(true)
  })
})

describe("computeProjectedMonthEnd", () => {
  it("projects correctly from day 15 of a 30-day month", () => {
    // If 1500 spent in 15 days, projected = 3000 for 30-day month
    const result = computeProjectedMonthEnd(1500, 15, 30)
    expect(result).toBe(3000)
  })

  it("returns 0 when no days elapsed", () => {
    expect(computeProjectedMonthEnd(0, 0, 30)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test alert-service
```

Expected: FAIL

- [ ] **Step 3: Implement the alert service**

Create `backend/src/services/alert-service.ts`:

```typescript
import { pool } from "../db.js"
import { sendEmail } from "./email.js"
import { sendSms } from "./sms.js"

export function shouldSendAlert(
  percentSpent: number,
  threshold: number,
  lastSentAt: Date | null
): boolean {
  if (percentSpent < threshold) return false
  if (!lastSentAt) return true
  // Only re-send if last sent was in a different calendar month
  const now = new Date()
  return (
    lastSentAt.getFullYear() !== now.getFullYear() ||
    lastSentAt.getMonth() !== now.getMonth()
  )
}

export function computeProjectedMonthEnd(
  spendToDate: number,
  daysElapsed: number,
  daysInMonth: number
): number {
  if (daysElapsed === 0) return 0
  return parseFloat(((spendToDate / daysElapsed) * daysInMonth).toFixed(2))
}

export async function checkAndSendBudgetAlerts(
  dealershipId: string,
  platform: string,
  monthSpend: number,
  monthlyCap: number,
  settings: any
) {
  const percent = (monthSpend / monthlyCap) * 100

  const at75 = shouldSendAlert(percent, 75, settings.alert_75_sent_at ? new Date(settings.alert_75_sent_at) : null)
  const at95 = shouldSendAlert(percent, 95, settings.alert_95_sent_at ? new Date(settings.alert_95_sent_at) : null)

  const userResult = await pool.query(
    "SELECT u.email, u.name FROM users u JOIN dealerships d ON u.dealership_id = d.id WHERE d.id = $1 AND u.role = 'owner'",
    [dealershipId]
  )
  const owner = userResult.rows[0]
  if (!owner) return

  if (at75 && settings.alert_75_email) {
    await sendEmail({
      to: owner.email,
      subject: `⚠️ Budget Alert: ${platform} spend at ${Math.round(percent)}% of monthly cap`,
      html: `<p>Hi ${owner.name},</p>
<p>Your <strong>${platform}</strong> ad spend has reached <strong>${Math.round(percent)}%</strong> of your ₹${monthlyCap.toLocaleString("en-IN")} monthly cap.</p>
<p>Current spend: ₹${monthSpend.toLocaleString("en-IN")}</p>
<p><a href="http://localhost:3000/dashboard/budget">Manage Budget</a></p>`,
    })
    await pool.query(
      "UPDATE budget_settings SET alert_75_sent_at = NOW() WHERE dealership_id = $1 AND platform = $2",
      [dealershipId, platform]
    )
  }

  if (at95) {
    if (settings.alert_95_email) {
      await sendEmail({
        to: owner.email,
        subject: `🚨 URGENT: ${platform} spend at ${Math.round(percent)}% of monthly cap`,
        html: `<p>Hi ${owner.name},</p>
<p>Your <strong>${platform}</strong> ad spend has reached <strong>${Math.round(percent)}%</strong> of your ₹${monthlyCap.toLocaleString("en-IN")} monthly cap.</p>
<p>Consider pausing campaigns to avoid overspend.</p>
<p><a href="http://localhost:3000/dashboard/budget">Pause Campaigns</a></p>`,
      })
    }
    if (settings.alert_95_sms && settings.phone_for_sms) {
      await sendSms({
        to: settings.phone_for_sms,
        message: `URGENT: Your ${platform} ad spend is at ${Math.round(percent)}% of monthly cap (₹${monthSpend.toLocaleString("en-IN")} / ₹${monthlyCap.toLocaleString("en-IN")}). Log in to pause campaigns.`,
      })
    }
    await pool.query(
      "UPDATE budget_settings SET alert_95_sent_at = NOW() WHERE dealership_id = $1 AND platform = $2",
      [dealershipId, platform]
    )
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test alert-service
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/alert-service.ts backend/src/services/alert-service.test.ts
git commit -m "feat: add budget alert service with once-per-month threshold detection"
```

---

## Task 4: Budget Monitor Cron

**Files:**
- Create: `backend/src/cron/monitor-budget.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the cron**

Create `backend/src/cron/monitor-budget.ts`:

```typescript
import cron from "node-cron"
import { pool } from "../db.js"
import { checkAndSendBudgetAlerts, computeProjectedMonthEnd } from "../services/alert-service.js"

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export async function monitorAllBudgets() {
  const settings = await pool.query(
    "SELECT * FROM budget_settings WHERE monthly_cap > 0"
  )

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstOfMonth = new Date(year, month, 1).toISOString().split("T")[0]
  const today = now.toISOString().split("T")[0]

  for (const setting of settings.rows) {
    const spendResult = await pool.query(
      `SELECT COALESCE(SUM(spend), 0) as month_spend
       FROM metrics_cache
       WHERE dealership_id = $1 AND platform = $2 AND date BETWEEN $3 AND $4`,
      [setting.dealership_id, setting.platform, firstOfMonth, today]
    )

    const monthSpend = parseFloat(spendResult.rows[0].month_spend)
    const daysElapsed = now.getDate()
    const projected = computeProjectedMonthEnd(monthSpend, daysElapsed, daysInMonth)

    console.log(`[budget-monitor] ${setting.platform} spend: ₹${monthSpend} / ₹${setting.monthly_cap} cap | Projected: ₹${projected}`)

    if (monthSpend > 0 && setting.monthly_cap > 0) {
      await checkAndSendBudgetAlerts(
        setting.dealership_id,
        setting.platform,
        monthSpend,
        setting.monthly_cap,
        setting
      )
    }
  }
}

export async function resetMonthlyAlerts() {
  await pool.query(
    "UPDATE budget_settings SET alert_75_sent_at = NULL, alert_95_sent_at = NULL"
  )
  console.log("[budget-monitor] Monthly alert flags reset")
}

export function startBudgetMonitorCron() {
  // Every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    monitorAllBudgets().catch(console.error)
  })
  // 1st of every month at midnight IST (UTC 18:30 on last day, close enough)
  cron.schedule("30 18 L * *", () => {
    resetMonthlyAlerts().catch(console.error)
  })
  console.log("[budget-monitor] Cron started — monitors every 15 minutes, resets monthly")
}
```

- [ ] **Step 2: Register in index.ts**

Modify `backend/src/index.ts`:

```typescript
import dotenv from "dotenv"
import app from "./app.js"
import { startMetricsSyncCron } from "./cron/sync-metrics.js"
import { startLeadSyncCron } from "./cron/sync-leads.js"
import { startBudgetMonitorCron } from "./cron/monitor-budget.js"

dotenv.config()

const port = Number(process.env.PORT ?? 4000)

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`)
  startMetricsSyncCron()
  startLeadSyncCron()
  startBudgetMonitorCron()
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/cron/monitor-budget.ts backend/src/index.ts
git commit -m "feat: add 15-minute budget monitoring cron with monthly alert reset"
```

---

## Task 5: Budget API Routes

**Files:**
- Create: `backend/src/routes/budget.ts`
- Create: `backend/src/routes/budget.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing API tests**

Create `backend/src/routes/budget.test.ts`:

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

describe("GET /api/budget/settings", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/budget/settings")
    expect(res.status).toBe(401)
  })

  it("returns empty array when no settings configured", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/budget/settings")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })
})

describe("PUT /api/budget/settings", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("creates budget settings", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .put("/api/budget/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ platform: "google", monthly_cap: 50000, alert_75_email: true, alert_95_email: true, alert_95_sms: false })
    expect(res.status).toBe(200)
    expect(Number(res.body.monthly_cap)).toBe(50000)
  })

  it("updates existing settings on second call", async () => {
    const token = makeToken(user.id, dealership.id)
    await request(app)
      .put("/api/budget/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ platform: "google", monthly_cap: 50000 })
    const res = await request(app)
      .put("/api/budget/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ platform: "google", monthly_cap: 80000 })
    expect(Number(res.body.monthly_cap)).toBe(80000)
  })
})

describe("POST /api/budget/pause-all", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("returns 400 without confirmation token", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .post("/api/budget/pause-all")
      .set("Authorization", `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it("pauses all active campaigns with valid confirmation", async () => {
    await testPool.query(
      "INSERT INTO campaigns (dealership_id, name, budget, start_date, end_date, platforms, status) VALUES ($1, 'Camp A', 5000, '2026-06-01', '2026-06-30', '{google}', 'active')",
      [dealership.id]
    )
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .post("/api/budget/pause-all")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirmationToken: "PAUSE_ALL_CONFIRMED" })
    expect(res.status).toBe(200)
    expect(res.body.paused).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test routes/budget
```

Expected: FAIL — 404

- [ ] **Step 3: Implement budget router**

Create `backend/src/routes/budget.ts`:

```typescript
import express from "express"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { pauseGoogleCampaign } from "../services/google-ads-campaigns.js"
import { setMetaCampaignStatus } from "../services/meta-ads-campaigns.js"
import { computeProjectedMonthEnd } from "../services/alert-service.js"

const router = express.Router()

router.get("/settings", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const today = now.toISOString().split("T")[0]
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const settings = await pool.query(
    "SELECT * FROM budget_settings WHERE dealership_id = $1",
    [dealershipId]
  )

  const enriched = await Promise.all(
    settings.rows.map(async (s) => {
      const spendResult = await pool.query(
        `SELECT COALESCE(SUM(spend), 0) as month_spend FROM metrics_cache
         WHERE dealership_id = $1 AND platform = $2 AND date BETWEEN $3 AND $4`,
        [dealershipId, s.platform, firstOfMonth, today]
      )
      const monthSpend = parseFloat(spendResult.rows[0].month_spend)
      const percentUsed = s.monthly_cap > 0 ? (monthSpend / s.monthly_cap) * 100 : 0
      const projected = computeProjectedMonthEnd(monthSpend, now.getDate(), daysInMonth)

      return {
        ...s,
        month_spend: monthSpend,
        percent_used: parseFloat(percentUsed.toFixed(1)),
        projected_month_end: projected,
      }
    })
  )

  res.json(enriched)
})

router.put("/settings", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const {
    platform,
    monthly_cap,
    alert_75_email = true,
    alert_95_email = true,
    alert_95_sms = false,
    phone_for_sms,
  } = req.body

  if (!platform || monthly_cap === undefined) {
    res.status(400).json({ error: "platform and monthly_cap are required" })
    return
  }

  const result = await pool.query(
    `INSERT INTO budget_settings (dealership_id, platform, monthly_cap, alert_75_email, alert_95_email, alert_95_sms, phone_for_sms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (dealership_id, platform) DO UPDATE
     SET monthly_cap = EXCLUDED.monthly_cap,
         alert_75_email = EXCLUDED.alert_75_email,
         alert_95_email = EXCLUDED.alert_95_email,
         alert_95_sms = EXCLUDED.alert_95_sms,
         phone_for_sms = EXCLUDED.phone_for_sms
     RETURNING *`,
    [dealershipId, platform, monthly_cap, alert_75_email, alert_95_email, alert_95_sms, phone_for_sms ?? null]
  )
  res.json(result.rows[0])
})

router.post("/pause-all", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { confirmationToken } = req.body

  if (confirmationToken !== "PAUSE_ALL_CONFIRMED") {
    res.status(400).json({ error: "confirmationToken must be 'PAUSE_ALL_CONFIRMED'" })
    return
  }

  const campaigns = await pool.query(
    "SELECT * FROM campaigns WHERE dealership_id = $1 AND status = 'active'",
    [dealershipId]
  )

  const accounts = await pool.query(
    "SELECT platform, access_token, refresh_token, platform_account_id FROM ad_accounts WHERE dealership_id = $1",
    [dealershipId]
  )
  const accountMap = Object.fromEntries(accounts.rows.map((a: any) => [a.platform, a]))

  let pausedCount = 0
  for (const c of campaigns.rows) {
    try {
      if (c.google_campaign_id && accountMap.google) {
        const acc = accountMap.google
        await pauseGoogleCampaign(acc.access_token, acc.refresh_token, acc.platform_account_id, c.google_campaign_id)
      }
      if (c.meta_campaign_id && accountMap.meta) {
        await setMetaCampaignStatus(accountMap.meta.access_token, c.meta_campaign_id, "PAUSED")
      }
      await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [c.id])
      pausedCount++
    } catch (err) {
      console.error(`Failed to pause campaign ${c.id}:`, err)
    }
  }

  res.json({ paused: pausedCount, message: `${pausedCount} campaign(s) paused` })
})

export default router
```

- [ ] **Step 4: Register router in app.ts**

Add to `backend/src/app.ts`:

```typescript
import budgetRouter from "./routes/budget.js"
// ...after existing routers:
app.use("/api/budget", budgetRouter)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npm test routes/budget
```

Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/budget.ts backend/src/routes/budget.test.ts backend/src/app.ts
git commit -m "feat: add budget settings, pause-all, and monitoring routes"
```

---

## Task 6: Wire Budget Frontend

**Files:**
- Modify: `frontend/app/dashboard/budget/page.tsx`

- [ ] **Step 1: Replace mock budget page**

Replace `frontend/app/dashboard/budget/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { api } from "@/lib/api"

const PLATFORMS = ["google", "meta"] as const
type Platform = typeof PLATFORMS[number]

function ProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 90 ? "bg-red-500" :
    percent >= 75 ? "bg-yellow-500" :
    "bg-green-500"
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
      <div
        className={`${color} h-2.5 rounded-full transition-all`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  )
}

export default function BudgetPage() {
  const { data: settings, isLoading } = useSWR("budget-settings", api.budget.settings)
  const [capInputs, setCapInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [pauseConfirm, setPauseConfirm] = useState(false)
  const [pausing, setPausing] = useState(false)

  function getSettings(platform: Platform) {
    return settings?.find((s: any) => s.platform === platform)
  }

  async function handleCapSave(platform: Platform) {
    const value = capInputs[platform]
    if (!value) return
    setSaving(platform)
    await api.budget.update({ platform, monthly_cap: Number(value) })
    mutate("budget-settings")
    setCapInputs((prev) => ({ ...prev, [platform]: "" }))
    setSaving(null)
  }

  async function handlePauseAll() {
    setPausing(true)
    await api.budget.pauseAll("PAUSE_ALL_CONFIRMED")
    mutate("budget-settings")
    setPauseConfirm(false)
    setPausing(false)
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Budget Manager</h1>

      <div className="space-y-4 mb-8">
        {PLATFORMS.map((platform) => {
          const s = getSettings(platform)
          const cap = s ? Number(s.monthly_cap) : 0
          const spent = s ? Number(s.month_spend) : 0
          const percent = s ? s.percent_used : 0
          const projected = s ? Number(s.projected_month_end) : 0

          return (
            <div key={platform} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold capitalize">
                  {platform === "google" ? "Google Ads" : "Meta Ads"}
                </div>
                <div className="text-sm text-gray-500">
                  {cap > 0 ? `₹${spent.toLocaleString("en-IN")} / ₹${cap.toLocaleString("en-IN")}` : "No cap set"}
                </div>
              </div>

              {cap > 0 && (
                <>
                  <ProgressBar percent={percent} />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{percent.toFixed(1)}% used</span>
                    <span>Projected: ₹{projected.toLocaleString("en-IN")}</span>
                  </div>
                </>
              )}

              <div className="flex gap-2 mt-4">
                <input
                  type="number"
                  placeholder={cap > 0 ? `Current: ₹${cap.toLocaleString("en-IN")}` : "Set monthly cap (₹)"}
                  value={capInputs[platform] ?? ""}
                  onChange={(e) => setCapInputs((prev) => ({ ...prev, [platform]: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => handleCapSave(platform)}
                  disabled={!capInputs[platform] || saving === platform}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
                >
                  {saving === platform ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pause All */}
      <div className="border-t border-gray-200 pt-6">
        {!pauseConfirm ? (
          <button
            onClick={() => setPauseConfirm(true)}
            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-sm font-medium hover:bg-red-100"
          >
            Pause All Campaigns
          </button>
        ) : (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800 font-medium mb-3">
              This will immediately pause all active campaigns on both Google Ads and Meta Ads.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePauseAll}
                disabled={pausing}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded"
              >
                {pausing ? "Pausing..." : "Confirm Pause All"}
              </button>
              <button
                onClick={() => setPauseConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/budget/page.tsx
git commit -m "feat: wire budget manager to real API with progress bars and pause-all"
```

---

**Phase 3a complete when:** Budget caps save per platform, progress bars reflect real month spend, alert logs appear in console when thresholds crossed, pause-all pauses all active campaigns.
