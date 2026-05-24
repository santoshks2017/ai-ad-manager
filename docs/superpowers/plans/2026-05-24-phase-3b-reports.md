# Phase 3b: Weekly Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated weekly report system that generates metrics summaries from DB, renders a PDF, stores it locally, sends a console-stub email, runs every Monday at 8AM IST via cron, and wires the Reports frontend with a list view, full report detail, and "Send Now" button.

**Architecture:** The report generator reads the prior Mon–Sun week from metrics_cache (no live API calls). It computes week totals, WoW delta, and generates a plain-language insight sentence from templates. html-pdf-node renders HTML to PDF, saved to `backend/reports/`. The reports route reads from the reports DB table. "Send Now" runs the full pipeline on demand.

**Tech Stack:** html-pdf-node, node-cron, vitest, supertest

**Entry condition:** Phases 1 + 2 complete — metrics_cache has at least one week of data.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/src/services/report-generator.ts` | Metric aggregation + insight sentence |
| Create | `backend/src/services/report-generator.test.ts` | Unit tests |
| Create | `backend/src/services/pdf-generator.ts` | HTML → PDF via html-pdf-node |
| Create | `backend/src/services/email-reports.ts` | Console-stub report email |
| Create | `backend/src/cron/weekly-report.ts` | Monday 8AM IST cron |
| Create | `backend/src/routes/reports.ts` | List + detail + send-now routes |
| Create | `backend/src/routes/reports.test.ts` | API integration tests |
| Modify | `backend/src/app.ts` | Register reports router |
| Modify | `backend/src/index.ts` | Start weekly report cron |
| Modify | `frontend/app/dashboard/reports/page.tsx` | Wire real data |

---

## Task 1: Report Generator Service

**Files:**
- Create: `backend/src/services/report-generator.ts`
- Create: `backend/src/services/report-generator.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `backend/src/services/report-generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  getWeekDateRange,
  generateInsightSentence,
  computeReportMetrics,
} from "./report-generator.js"

describe("getWeekDateRange", () => {
  it("returns Mon to Sun for a given reference date (Monday)", () => {
    // 2026-05-18 is a Monday
    const { start, end } = getWeekDateRange(new Date("2026-05-18"))
    expect(start).toBe("2026-05-18")
    expect(end).toBe("2026-05-24")
  })

  it("returns the previous week's Mon–Sun when called mid-week", () => {
    // 2026-05-20 is a Wednesday → previous Mon–Sun is May 11–17
    const { start, end } = getWeekDateRange(new Date("2026-05-20"))
    expect(start).toBe("2026-05-11")
    expect(end).toBe("2026-05-17")
  })
})

describe("generateInsightSentence", () => {
  it("generates a positive delta sentence", () => {
    const result = generateInsightSentence("Swift Launch", 300, -15)
    expect(result).toContain("Swift Launch")
    expect(result).toContain("₹300")
    expect(result).toContain("15%")
    expect(result).toContain("better")
  })

  it("generates a negative delta sentence when CPL is worse", () => {
    const result = generateInsightSentence("Test Drive", 500, 20)
    expect(result).toContain("higher")
  })

  it("generates a neutral sentence when no change", () => {
    const result = generateInsightSentence("Festive", 400, 0)
    expect(result).toContain("similar")
  })
})

describe("computeReportMetrics", () => {
  it("computes total spend and leads from cache rows", () => {
    const rows = [
      { spend: "1000", leads: 10 },
      { spend: "2000", leads: 20 },
    ]
    const result = computeReportMetrics(rows)
    expect(result.totalSpend).toBe(3000)
    expect(result.totalLeads).toBe(30)
    expect(result.cpl).toBe(100)
  })

  it("returns 0 CPL when no leads", () => {
    const result = computeReportMetrics([{ spend: "1000", leads: 0 }])
    expect(result.cpl).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test report-generator
```

Expected: FAIL

- [ ] **Step 3: Implement the report generator**

Create `backend/src/services/report-generator.ts`:

```typescript
import { pool } from "../db.js"

export function getWeekDateRange(referenceDate: Date = new Date()): { start: string; end: string } {
  const d = new Date(referenceDate)
  // Get the most recently completed Mon–Sun week
  const dayOfWeek = d.getDay() // 0 = Sun, 1 = Mon, ...
  // Find last Monday
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  // If today is Monday, go to the previous week's Monday
  const lastMonday = new Date(d)
  lastMonday.setDate(d.getDate() - daysToLastMonday - (daysToLastMonday === 0 ? 7 : 0))
  lastMonday.setHours(0, 0, 0, 0)

  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)

  return {
    start: lastMonday.toISOString().split("T")[0],
    end: lastSunday.toISOString().split("T")[0],
  }
}

export function computeReportMetrics(rows: Array<{ spend: string | number; leads: number }>) {
  const totalSpend = rows.reduce((s, r) => s + parseFloat(String(r.spend)), 0)
  const totalLeads = rows.reduce((s, r) => s + Number(r.leads), 0)
  const cpl = totalLeads > 0 ? parseFloat((totalSpend / totalLeads).toFixed(2)) : 0
  return { totalSpend: parseFloat(totalSpend.toFixed(2)), totalLeads, cpl }
}

export function generateInsightSentence(
  topCampaignName: string,
  cpl: number,
  cplDeltaPercent: number
): string {
  const cplFormatted = `₹${cpl.toLocaleString("en-IN")}`

  if (cplDeltaPercent < -5) {
    const improvement = Math.abs(cplDeltaPercent).toFixed(0)
    return `Your "${topCampaignName}" campaign delivered leads at ${cplFormatted} CPL — ${improvement}% better than last week.`
  }

  if (cplDeltaPercent > 5) {
    const increase = cplDeltaPercent.toFixed(0)
    return `Your "${topCampaignName}" campaign delivered leads at ${cplFormatted} CPL — ${increase}% higher than last week.`
  }

  return `Your "${topCampaignName}" campaign delivered leads at ${cplFormatted} CPL — similar to last week.`
}

export async function generateWeeklyReport(dealershipId: string): Promise<{
  periodStart: string
  periodEnd: string
  totalSpend: number
  totalLeads: number
  cpl: number
  topCampaignId: string | null
  insightText: string
  platformBreakdown: { google: any; meta: any }
}> {
  const { start: periodStart, end: periodEnd } = getWeekDateRange()

  // Previous week for WoW comparison
  const prevEnd = new Date(periodStart)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevEnd.getDate() - 6)
  const prevStartStr = prevStart.toISOString().split("T")[0]
  const prevEndStr = prevEnd.toISOString().split("T")[0]

  const [currentRows, previousRows, campaignRows] = await Promise.all([
    pool.query(
      "SELECT platform, spend, leads FROM metrics_cache WHERE dealership_id = $1 AND date BETWEEN $2 AND $3",
      [dealershipId, periodStart, periodEnd]
    ),
    pool.query(
      "SELECT spend, leads FROM metrics_cache WHERE dealership_id = $1 AND date BETWEEN $2 AND $3",
      [dealershipId, prevStartStr, prevEndStr]
    ),
    pool.query(
      `SELECT c.id, c.name, SUM(mc.leads) as total_leads, SUM(mc.spend) as total_spend
       FROM campaigns c JOIN metrics_cache mc ON mc.dealership_id = c.dealership_id
       WHERE c.dealership_id = $1 AND mc.date BETWEEN $2 AND $3
       GROUP BY c.id, c.name ORDER BY total_leads DESC LIMIT 1`,
      [dealershipId, periodStart, periodEnd]
    ),
  ])

  const current = computeReportMetrics(currentRows.rows)
  const previous = computeReportMetrics(previousRows.rows)

  const cplDelta =
    previous.cpl > 0
      ? parseFloat((((current.cpl - previous.cpl) / previous.cpl) * 100).toFixed(1))
      : 0

  const platformBreakdown = {
    google: computeReportMetrics(currentRows.rows.filter((r: any) => r.platform === "google")),
    meta: computeReportMetrics(currentRows.rows.filter((r: any) => r.platform === "meta")),
  }

  const topCampaign = campaignRows.rows[0]
  const insightText = generateInsightSentence(
    topCampaign?.name ?? "your campaigns",
    current.cpl,
    cplDelta
  )

  return {
    periodStart,
    periodEnd,
    totalSpend: current.totalSpend,
    totalLeads: current.totalLeads,
    cpl: current.cpl,
    topCampaignId: topCampaign?.id ?? null,
    insightText,
    platformBreakdown,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test report-generator
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/report-generator.ts backend/src/services/report-generator.test.ts
git commit -m "feat: add weekly report generator with insight sentence and WoW comparison"
```

---

## Task 2: PDF Generator

**Files:**
- Create: `backend/src/services/pdf-generator.ts`

- [ ] **Step 1: Install html-pdf-node**

```bash
cd backend && npm install html-pdf-node
mkdir -p backend/reports
```

- [ ] **Step 2: Create PDF generator**

Create `backend/src/services/pdf-generator.ts`:

```typescript
import htmlPdf from "html-pdf-node"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = join(__dirname, "../../reports")

export function buildReportHtml(report: {
  periodStart: string
  periodEnd: string
  totalSpend: number
  totalLeads: number
  cpl: number
  insightText: string
  platformBreakdown: { google: any; meta: any }
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a2e; }
    h1 { color: #1e40af; margin-bottom: 4px; }
    .period { color: #6b7280; margin-bottom: 24px; }
    .insight { background: #eff6ff; border-left: 4px solid #1e40af; padding: 12px 16px; margin: 20px 0; font-size: 15px; }
    .kpis { display: flex; gap: 20px; margin: 24px 0; }
    .kpi { background: #f9fafb; border-radius: 8px; padding: 16px 20px; flex: 1; }
    .kpi .label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .kpi .value { font-size: 24px; font-weight: bold; margin-top: 4px; }
    .platform-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    footer { margin-top: 40px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>AI Ad Manager — Weekly Report</h1>
  <div class="period">Week of ${report.periodStart} to ${report.periodEnd}</div>

  <div class="insight">${report.insightText}</div>

  <div class="kpis">
    <div class="kpi">
      <div class="label">Total Spend</div>
      <div class="value">₹${report.totalSpend.toLocaleString("en-IN")}</div>
    </div>
    <div class="kpi">
      <div class="label">Total Leads</div>
      <div class="value">${report.totalLeads}</div>
    </div>
    <div class="kpi">
      <div class="label">Cost Per Lead</div>
      <div class="value">₹${report.cpl.toLocaleString("en-IN")}</div>
    </div>
  </div>

  <h3>Platform Breakdown</h3>
  <div class="platform-row"><span>Google Ads Spend</span><span>₹${report.platformBreakdown.google.totalSpend.toLocaleString("en-IN")}</span></div>
  <div class="platform-row"><span>Google Ads Leads</span><span>${report.platformBreakdown.google.totalLeads}</span></div>
  <div class="platform-row"><span>Meta Ads Spend</span><span>₹${report.platformBreakdown.meta.totalSpend.toLocaleString("en-IN")}</span></div>
  <div class="platform-row"><span>Meta Ads Leads</span><span>${report.platformBreakdown.meta.totalLeads}</span></div>

  <footer>Generated by AI Ad Manager · ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</footer>
</body>
</html>`
}

export async function generatePdf(reportData: Parameters<typeof buildReportHtml>[0]): Promise<string> {
  mkdirSync(REPORTS_DIR, { recursive: true })
  const html = buildReportHtml(reportData)
  const filename = `report-${reportData.periodStart}.pdf`
  const filePath = join(REPORTS_DIR, filename)

  const file = { content: html }
  const buffer = await htmlPdf.generatePdf(file, { format: "A4" })
  writeFileSync(filePath, buffer)

  console.log(`[pdf-generator] PDF saved: ${filePath}`)
  return filePath
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/pdf-generator.ts backend/reports/.gitkeep
git commit -m "feat: add HTML-to-PDF report generator"
```

---

## Task 3: Email Report Stub

**Files:**
- Create: `backend/src/services/email-reports.ts`

- [ ] **Step 1: Create email report stub**

Create `backend/src/services/email-reports.ts`:

```typescript
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { buildReportHtml } from "./pdf-generator.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SENT_DIR = join(__dirname, "../../reports/sent")

export async function sendWeeklyReportEmail(
  recipientEmail: string,
  recipientName: string,
  reportData: Parameters<typeof buildReportHtml>[0],
  pdfPath: string
): Promise<void> {
  // LOCAL STUB — replace with SendGrid in production:
  // await sgMail.send({
  //   from: 'reports@aiadmanager.com',
  //   to: recipientEmail,
  //   subject: `Your Weekly Ad Report — ${reportData.periodStart} to ${reportData.periodEnd}`,
  //   html: buildReportHtml(reportData),
  //   attachments: [{ content: fs.readFileSync(pdfPath).toString('base64'), filename: 'report.pdf', type: 'application/pdf', disposition: 'attachment' }]
  // })

  mkdirSync(SENT_DIR, { recursive: true })
  const sentFile = join(SENT_DIR, `report-${reportData.periodStart}-to-${recipientEmail}.html`)
  writeFileSync(sentFile, buildReportHtml(reportData))

  console.log(`[email-reports] Sent report to ${recipientName} <${recipientEmail}>`)
  console.log(`[email-reports] PDF attachment: ${pdfPath}`)
  console.log(`[email-reports] HTML preview saved: ${sentFile}`)
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/email-reports.ts backend/reports/sent/.gitkeep
git commit -m "feat: add console-stub weekly report email service"
```

---

## Task 4: Weekly Report Cron

**Files:**
- Create: `backend/src/cron/weekly-report.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create the cron**

Create `backend/src/cron/weekly-report.ts`:

```typescript
import cron from "node-cron"
import { pool } from "../db.js"
import { generateWeeklyReport } from "../services/report-generator.js"
import { generatePdf } from "../services/pdf-generator.js"
import { sendWeeklyReportEmail } from "../services/email-reports.js"

export async function runWeeklyReport(dealershipId: string) {
  console.log(`[weekly-report] Generating for dealership ${dealershipId}`)

  const reportData = await generateWeeklyReport(dealershipId)
  const pdfPath = await generatePdf(reportData)

  // Get owner email
  const ownerResult = await pool.query(
    "SELECT u.email, u.name FROM users u WHERE u.dealership_id = $1 AND u.role = 'owner' LIMIT 1",
    [dealershipId]
  )
  const owner = ownerResult.rows[0]
  if (!owner) {
    console.warn(`[weekly-report] No owner found for dealership ${dealershipId}`)
    return
  }

  await sendWeeklyReportEmail(owner.email, owner.name, reportData, pdfPath)

  // Save report record to DB
  const result = await pool.query(
    `INSERT INTO reports (dealership_id, period_start, period_end, total_spend, total_leads, cpl, top_campaign_id, insight_text, pdf_url, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
      dealershipId,
      reportData.periodStart,
      reportData.periodEnd,
      reportData.totalSpend,
      reportData.totalLeads,
      reportData.cpl,
      reportData.topCampaignId,
      reportData.insightText,
      pdfPath,
    ]
  )

  console.log(`[weekly-report] Saved report ${result.rows[0].id}`)
  return result.rows[0]
}

export async function runAllWeeklyReports() {
  const dealerships = await pool.query("SELECT DISTINCT id FROM dealerships")
  await Promise.all(dealerships.rows.map((d) => runWeeklyReport(d.id).catch(console.error)))
  console.log(`[weekly-report] All reports generated at ${new Date().toISOString()}`)
}

export function startWeeklyReportCron() {
  // Every Monday at 08:00 IST = 02:30 UTC
  cron.schedule("30 2 * * 1", () => {
    runAllWeeklyReports().catch(console.error)
  })
  console.log("[weekly-report] Cron started — fires every Monday at 08:00 IST")
}
```

- [ ] **Step 2: Register cron in index.ts**

Modify `backend/src/index.ts`:

```typescript
import dotenv from "dotenv"
import app from "./app.js"
import { startMetricsSyncCron } from "./cron/sync-metrics.js"
import { startLeadSyncCron } from "./cron/sync-leads.js"
import { startBudgetMonitorCron } from "./cron/monitor-budget.js"
import { startWeeklyReportCron } from "./cron/weekly-report.js"

dotenv.config()

const port = Number(process.env.PORT ?? 4000)

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`)
  startMetricsSyncCron()
  startLeadSyncCron()
  startBudgetMonitorCron()
  startWeeklyReportCron()
})
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/cron/weekly-report.ts backend/src/index.ts
git commit -m "feat: add Monday 8AM IST weekly report cron"
```

---

## Task 5: Reports API Routes

**Files:**
- Create: `backend/src/routes/reports.ts`
- Create: `backend/src/routes/reports.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing API tests**

Create `backend/src/routes/reports.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest"
import request from "supertest"
import jwt from "jsonwebtoken"
import app from "../app.js"
import { clearTables, seedDealership, seedUser } from "../test/helpers.js"
import { testPool } from "../test/setup.js"

const SECRET = "local-dev-secret-change-in-prod-32chars"
process.env.NEXTAUTH_SECRET = SECRET
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test"

vi.mock("../services/report-generator.js", () => ({
  generateWeeklyReport: vi.fn().mockResolvedValue({
    periodStart: "2026-05-11",
    periodEnd: "2026-05-17",
    totalSpend: 5000,
    totalLeads: 20,
    cpl: 250,
    topCampaignId: null,
    insightText: "Your campaigns delivered leads at ₹250 CPL — similar to last week.",
    platformBreakdown: {
      google: { totalSpend: 3000, totalLeads: 12, cpl: 250 },
      meta: { totalSpend: 2000, totalLeads: 8, cpl: 250 },
    },
  }),
}))

vi.mock("../services/pdf-generator.js", () => ({
  generatePdf: vi.fn().mockResolvedValue("/tmp/test-report.pdf"),
}))

vi.mock("../services/email-reports.js", () => ({
  sendWeeklyReportEmail: vi.fn().mockResolvedValue(undefined),
}))

function makeToken(userId: string, dealershipId: string) {
  return jwt.sign({ userId, dealershipId }, SECRET, { algorithm: "HS256" })
}

async function seedReport(dealershipId: string) {
  const { rows } = await testPool.query(
    `INSERT INTO reports (dealership_id, period_start, period_end, total_spend, total_leads, cpl, insight_text, pdf_url, sent_at)
     VALUES ($1, '2026-05-11', '2026-05-17', 5000, 20, 250, 'Great week!', '/tmp/test.pdf', NOW())
     RETURNING *`,
    [dealershipId]
  )
  return rows[0]
}

describe("GET /api/reports", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
    await seedReport(dealership.id)
  })

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/reports")
    expect(res.status).toBe(401)
  })

  it("returns list of reports", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0]).toHaveProperty("insight_text")
  })
})

describe("POST /api/reports/send-now", () => {
  let dealership: any, user: any

  beforeEach(async () => {
    await clearTables()
    dealership = await seedDealership()
    user = await seedUser(dealership.id)
  })

  it("generates and saves a report on demand", async () => {
    const token = makeToken(user.id, dealership.id)
    const res = await request(app)
      .post("/api/reports/send-now")
      .set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty("id")
    expect(res.body.insight_text).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && npm test routes/reports
```

Expected: FAIL

- [ ] **Step 3: Implement reports router**

Create `backend/src/routes/reports.ts`:

```typescript
import express from "express"
import { pool } from "../db.js"
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js"
import { runWeeklyReport } from "../cron/weekly-report.js"

const router = express.Router()

router.get("/", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const result = await pool.query(
    `SELECT r.*, c.name as top_campaign_name
     FROM reports r LEFT JOIN campaigns c ON r.top_campaign_id = c.id
     WHERE r.dealership_id = $1
     ORDER BY r.created_at DESC
     LIMIT 12`,
    [dealershipId]
  )
  res.json(result.rows)
})

router.get("/:id", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  const { id } = req.params
  const result = await pool.query(
    `SELECT r.*, c.name as top_campaign_name
     FROM reports r LEFT JOIN campaigns c ON r.top_campaign_id = c.id
     WHERE r.id = $1 AND r.dealership_id = $2`,
    [id, dealershipId]
  )
  if (!result.rows[0]) { res.status(404).json({ error: "Report not found" }); return }
  res.json(result.rows[0])
})

// POST /api/reports/send-now — must be before /:id
router.post("/send-now", requireAuth, async (req, res) => {
  const { dealershipId } = (req as AuthenticatedRequest).user
  try {
    const report = await runWeeklyReport(dealershipId)
    res.status(201).json(report)
  } catch (err: any) {
    console.error("[reports] send-now error:", err)
    res.status(500).json({ error: err.message })
  }
})

export default router
```

- [ ] **Step 4: Register router in app.ts**

Add to `backend/src/app.ts`:

```typescript
import reportsRouter from "./routes/reports.js"
// ...after existing routers:
app.use("/api/reports", reportsRouter)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npm test routes/reports
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/reports.ts backend/src/routes/reports.test.ts backend/src/app.ts
git commit -m "feat: add reports list, detail, and send-now API routes"
```

---

## Task 6: Wire Reports Frontend

**Files:**
- Modify: `frontend/app/dashboard/reports/page.tsx`

- [ ] **Step 1: Replace mock reports page**

Replace `frontend/app/dashboard/reports/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { api } from "@/lib/api"

export default function ReportsPage() {
  const { data: reports, isLoading } = useSWR("reports", api.reports.list)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendMessage, setSendMessage] = useState("")

  const { data: selectedReport } = useSWR(
    selectedReportId ? `report-${selectedReportId}` : null,
    () => selectedReportId ? api.reports.get(selectedReportId) : null
  )

  async function handleSendNow() {
    setSending(true)
    setSendMessage("")
    try {
      const report = await api.reports.sendNow()
      mutate("reports")
      setSendMessage(`Report generated for ${report.period_start} to ${report.period_end} and sent.`)
    } catch {
      setSendMessage("Failed to generate report. Ensure there is metrics data available.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Weekly Reports</h1>
        <button
          onClick={handleSendNow}
          disabled={sending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? "Generating..." : "Send Now"}
        </button>
      </div>

      {sendMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
          {sendMessage}
        </div>
      )}

      {isLoading && <div className="text-gray-400">Loading reports...</div>}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Report List */}
        <div className="space-y-3">
          {(reports ?? []).map((r: any) => (
            <button
              key={r.id}
              onClick={() => setSelectedReportId(r.id)}
              className={`w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors ${
                selectedReportId === r.id ? "border-blue-500 shadow-sm" : "border-gray-200"
              }`}
            >
              <div className="text-sm font-medium text-gray-900">
                {r.period_start} → {r.period_end}
              </div>
              <div className="flex gap-4 mt-2 text-sm text-gray-500">
                <span>₹{Number(r.total_spend).toLocaleString("en-IN")}</span>
                <span>{r.total_leads} leads</span>
                <span>₹{Number(r.cpl).toLocaleString("en-IN")} CPL</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Sent {new Date(r.sent_at).toLocaleDateString("en-IN")}
              </div>
            </button>
          ))}
          {!isLoading && (!reports || reports.length === 0) && (
            <div className="text-gray-400 text-sm">No reports yet. Reports are generated every Monday at 8AM IST, or click "Send Now" to generate one.</div>
          )}
        </div>

        {/* Report Detail */}
        {selectedReport && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="text-sm text-gray-400 mb-3">
              {selectedReport.period_start} to {selectedReport.period_end}
            </div>

            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded mb-4 text-sm text-blue-900">
              {selectedReport.insight_text}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                ["Total Spend", `₹${Number(selectedReport.total_spend).toLocaleString("en-IN")}`],
                ["Total Leads", selectedReport.total_leads],
                ["Cost Per Lead", `₹${Number(selectedReport.cpl).toLocaleString("en-IN")}`],
              ].map(([label, value]) => (
                <div key={label as string} className="bg-gray-50 rounded p-3">
                  <div className="text-xs text-gray-400">{label}</div>
                  <div className="font-bold text-gray-900">{value}</div>
                </div>
              ))}
            </div>

            {selectedReport.top_campaign_name && (
              <div className="text-sm text-gray-600">
                <span className="text-gray-400">Top Campaign: </span>
                {selectedReport.top_campaign_name}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/reports/page.tsx
git commit -m "feat: wire reports page to real API with list, detail, and send-now"
```

---

**Phase 3b complete when:** Weekly report cron fires at startup (test manually), PDF saved in `backend/reports/`, HTML preview in `backend/reports/sent/`, full report visible in UI, "Send Now" generates and saves a report record.
