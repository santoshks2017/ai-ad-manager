# AI Ad Manager — MVP Multi-Agent Development Workplan
**Date:** 2026-05-24
**Scope:** Full MVP build and test across 7 agents in 4 phases, running entirely on localhost

---

## Context

The codebase is a UI-complete scaffold with zero backend integration:
- All 9 frontend screens are styled with mock data (Next.js, Tailwind)
- DB schema is defined in `backend/src/db/schema.sql` but not deployed
- Only 3 stub backend routes exist (`/api/health`, `/api/auth/me`, `/api/dashboard/metrics`)
- No API calls from frontend to backend

**Local dev environment:**
- Frontend: `localhost:3000` (Next.js)
- Backend: `localhost:4000` (Express)
- Database: Local PostgreSQL (`ai_ad_manager_dev`; `ai_ad_manager_test` for tests)
- Email/SMS: Console log / local file output only (SendGrid/MSG91 interface-compatible for later swap)
- Google Ads + Meta: Sandbox/test credentials

---

## Agent Map

```
Phase 1 (sequential — must complete first)
└── Agent 1: Foundation
      DB migrations → Auth → Ad Account OAuth → Token management

Phase 2 (parallel — after Phase 1)
├── Agent 2: Dashboard & Metrics
├── Agent 3: Campaign Launcher
└── Agent 4: Lead Inbox

Phase 3 (parallel — after Phase 2)
├── Agent 5: Budget Manager
└── Agent 6: Reports

Phase 4 (sequential — after Phase 3)
└── Agent 7: Test Suite
```

---

## Phase 1: Foundation Agent

**Entry condition:** Fresh repo, schema.sql exists, no DB deployed.
**Exit condition:** User can sign in with Google, persisted to DB, connect Google Ads and Meta sandbox accounts, tokens stored encrypted, dashboard routes protected.

### Tasks

1. **DB setup** — create local PostgreSQL database `ai_ad_manager_dev`, run `schema.sql`, verify all 8 tables created
2. **Environment files** — create `backend/.env` with `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `META_APP_ID`, `META_APP_SECRET`; create `frontend/.env.local` with `NEXTAUTH_URL=http://localhost:3000`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `API_URL=http://localhost:4000`
3. **NextAuth callbacks** — implement `jwt` and `session` callbacks in `frontend/lib/auth.ts`; on first login create user + dealership row in DB; store `dealership_id` in session token
4. **Auth middleware** — `backend/src/middleware/auth.ts` extracts and verifies NextAuth JWT on every protected route; attaches `req.user` with `id` and `dealership_id`
5. **`GET /api/auth/me`** — query users + dealerships tables, return full profile
6. **Frontend route guard** — `frontend/middleware.ts` redirects unauthenticated requests on `/dashboard/*` to `/login`; redirects post-login to `/dashboard/settings` if no ad account connected
7. **Google Ads OAuth** — `GET /api/integrations/google/auth-url` returns OAuth URL with Ads API scope; `POST /api/integrations/google/callback` exchanges code for tokens, encrypts with AES-256, stores in `ad_accounts`
8. **Meta OAuth** — `GET /api/integrations/meta/auth-url` and `POST /api/integrations/meta/callback` — same pattern for Meta Business Login
9. **Token refresh** — middleware checks `token_expires_at` before every Ads API call; refreshes silently if expired; surfaces reconnect banner to frontend if refresh fails
10. **Settings page wiring** — `frontend/app/dashboard/settings/page.tsx` calls real connect/disconnect endpoints; shows connected account name post-OAuth

### Files Created/Modified

| File | Action |
|------|--------|
| `backend/src/db/migrate.ts` | Create — runs schema.sql against local PG |
| `backend/src/middleware/auth.ts` | Create — JWT verification middleware |
| `backend/src/routes/auth.ts` | Modify — implement /api/auth/me with real DB query |
| `backend/src/routes/integrations.ts` | Create — Google + Meta OAuth flows |
| `backend/src/services/token-store.ts` | Create — AES-256 encrypt/decrypt/refresh tokens |
| `frontend/lib/auth.ts` | Modify — NextAuth jwt + session callbacks |
| `frontend/middleware.ts` | Create — route protection + onboarding redirect |
| `frontend/app/dashboard/settings/page.tsx` | Modify — wire connect/disconnect to API |

### Tests

- **Unit:** token encryption/decryption, JWT verification, token refresh logic
- **API:** `GET /api/auth/me` (authenticated + unauthenticated), OAuth callback with mock token exchange, disconnect endpoint

---

## Phase 2a: Dashboard & Metrics Agent

**Entry condition:** Phase 1 complete; at least one sandbox ad account connected.
**Exit condition:** Dashboard shows live sandbox metrics, date filter works, WoW deltas display correctly, data refreshes from cache.

### Tasks

1. **Google Ads adapter** — `backend/src/services/google-ads.ts` — GAQL query fetching `metrics.cost_micros`, `metrics.impressions`, `metrics.clicks`, `metrics.conversions` per campaign per day; accepts `dateRange` param; returns normalized array
2. **Meta Ads adapter** — `backend/src/services/meta-ads.ts` — Graph API `/insights` call fetching `spend`, `impressions`, `clicks`, `leads` per campaign per day; same normalized output shape
3. **Aggregation service** — `backend/src/services/metrics-aggregator.ts` — merges both platform arrays, computes `totalSpend`, `totalLeads`, `costPerLead`, `activeCampaigns`, `platformBreakdown`, `leadsTimeSeries`
4. **Metrics cache cron** — `backend/src/cron/sync-metrics.ts` — runs every 15 minutes via `node-cron`; calls both adapters, upserts results into `metrics_cache` table by `(dealership_id, platform, date)`
5. **`GET /api/dashboard/metrics`** — reads from `metrics_cache`; accepts `?period=today|week|month|custom&from=&to=`; computes WoW delta percentages
6. **`GET /api/dashboard/campaigns/top`** — queries `metrics_cache` joined with `campaigns`, returns highest-leads campaign for period
7. **Frontend dashboard wiring** — replace mock data in `frontend/app/dashboard/page.tsx` with `useSWR` calls to both endpoints; date range selector triggers refetch; KPI cards show WoW delta arrows; alert banner appears when campaign spend > 75% of cap

### Files Created/Modified

| File | Action |
|------|--------|
| `backend/src/services/google-ads.ts` | Create — GAQL metrics adapter |
| `backend/src/services/meta-ads.ts` | Create — Graph API metrics adapter |
| `backend/src/services/metrics-aggregator.ts` | Create — combine + aggregate |
| `backend/src/cron/sync-metrics.ts` | Create — 15-min cache refresh cron |
| `backend/src/routes/dashboard.ts` | Modify — implement both endpoints with real DB reads |
| `frontend/app/dashboard/page.tsx` | Modify — wire useSWR, date filter, WoW deltas |

### Tests

- **Unit:** GAQL response normalizer, Meta response normalizer, aggregation math, WoW delta calculation
- **API:** `/api/dashboard/metrics` with seeded cache data, period filter variations, unauthenticated rejection

---

## Phase 2b: Campaign Launcher Agent

**Entry condition:** Phase 1 complete; ad accounts connected.
**Exit condition:** Full campaign creation flow works end-to-end with sandbox APIs, campaigns appear in list with live metrics, pause/resume updates both DB and platform.

### Tasks

1. **Templates data** — `backend/src/data/templates.json` — 5 templates (Model Launch, Test Drive, Exchange Offer, Festive Sale, Year-End Clearance); each with `id`, `name`, `useCase`, `headline` (with `{{carModel}}` placeholder), `description`, `cta`, `thumbnailColor`
2. **`GET /api/campaigns/templates`** — returns templates JSON
3. **Google Ads campaign creation service** — `backend/src/services/google-ads-campaigns.ts` — creates Campaign → Ad Group → Responsive Search Ad → Location targeting; accepts unified campaign params; returns `google_campaign_id`
4. **Meta campaign creation service** — `backend/src/services/meta-ads-campaigns.ts` — creates Campaign → Ad Set → Ad Creative → Ad via Graph API; returns `meta_campaign_id`
5. **`POST /api/campaigns/create`** — validates params, calls one or both platform services based on `platforms[]`, saves campaign row to DB; if one platform fails rolls back the other and returns specific error
6. **`GET /api/campaigns`** — lists campaigns for dealership with aggregated metrics from `metrics_cache`; supports `?status=active|paused|completed`
7. **`PATCH /api/campaigns/:id/pause`** and **`PATCH /api/campaigns/:id/resume`** — calls platform APIs then updates DB `status`
8. **Campaign list wiring** — `frontend/app/dashboard/campaigns/page.tsx` fetches real data; pause/resume toggle calls API and optimistically updates UI
9. **New campaign flow** — create `frontend/app/dashboard/campaigns/new/page.tsx` (template picker) and `frontend/app/dashboard/campaigns/new/[templateId]/page.tsx` (3-step: Details → Preview → Publish); preview renders Google Search Ad + Meta card format; confirmation screen shows campaign ID

### Files Created/Modified

| File | Action |
|------|--------|
| `backend/src/data/templates.json` | Create — 5 campaign templates |
| `backend/src/services/google-ads-campaigns.ts` | Create — Google campaign CRUD |
| `backend/src/services/meta-ads-campaigns.ts` | Create — Meta campaign CRUD |
| `backend/src/routes/campaigns.ts` | Create — all campaign routes |
| `frontend/app/dashboard/campaigns/page.tsx` | Modify — wire real data + pause/resume |
| `frontend/app/dashboard/campaigns/new/page.tsx` | Create — template picker |
| `frontend/app/dashboard/campaigns/new/[templateId]/page.tsx` | Create — 3-step form flow |

### Tests

- **Unit:** template placeholder substitution, Google Ads API payload builder, Meta API payload builder, rollback logic on partial failure
- **API:** `POST /api/campaigns/create` success + single platform failure + both platforms failure, pause/resume, list with status filter

---

## Phase 2c: Lead Inbox Agent

**Entry condition:** Phase 1 complete; ad accounts connected; campaigns table exists.
**Exit condition:** Leads from both sandbox platforms appear in inbox within 5 minutes, status/notes save, CSV export works, new badge count updates.

### Tasks

1. **Google lead polling service** — `backend/src/services/lead-sync.ts` — calls Google Ads API `LeadFormSubmissionService` every 5 minutes; fetches submissions since last poll timestamp stored in DB; normalizes to unified lead schema
2. **Meta lead webhook receiver** — `POST /api/webhooks/meta/leads` — verifies Meta webhook signature, fetches full lead data from Graph API, normalizes, upserts to `leads` table
3. **Meta webhook verification** — `GET /api/webhooks/meta/verify` — handles Meta's hub.verify challenge
4. **Lead sync cron** — `backend/src/cron/sync-leads.ts` — runs every 5 minutes, calls Google polling service for all connected Google accounts
5. **`GET /api/leads`** — paginated (50/page); supports `?status=&platform=&campaign_id=&search=&page=`; phone masked (last 4 digits shown)
6. **`GET /api/leads/:id`** — full lead detail with phone unmasked
7. **`PATCH /api/leads/:id`** — update `status` or `notes`
8. **`GET /api/leads/export`** — streams CSV of filtered leads using same filter params as list
9. **`GET /api/leads/count`** — returns count of `status=new` leads for nav badge; frontend polls every 2 minutes
10. **Lead inbox wiring** — `frontend/app/dashboard/leads/page.tsx` fetches real data; search/filter triggers refetch; status dropdown auto-saves; notes textarea debounces 500ms before save; phone reveal on click; export downloads CSV; new badge in sidebar

### Files Created/Modified

| File | Action |
|------|--------|
| `backend/src/services/lead-sync.ts` | Create — Google lead polling |
| `backend/src/routes/webhooks.ts` | Create — Meta webhook receiver + verifier |
| `backend/src/cron/sync-leads.ts` | Create — 5-min polling cron |
| `backend/src/routes/leads.ts` | Create — all lead CRUD routes |
| `frontend/app/dashboard/leads/page.tsx` | Modify — wire real data, all interactions |
| `frontend/components/ui/Sidebar.tsx` | Modify — new leads badge count |

### Tests

- **Unit:** Google lead response normalizer, Meta lead response normalizer, phone masking, CSV serializer
- **API:** GET leads with all filter combinations, PATCH status/notes, export endpoint, webhook signature verification
- **Webhook:** mock Meta payload → verify leads appear in DB

---

## Phase 3a: Budget Manager Agent

**Entry condition:** Phases 1 + 2 complete; campaigns and metrics_cache populated.
**Exit condition:** Budget caps save, progress bars show real spend, threshold alerts log correctly, pause-all pauses campaigns on both platforms.

### Tasks

1. **Schema migration** — add `alert_75_sent_at TIMESTAMP` and `alert_95_sent_at TIMESTAMP` columns to `budget_settings` table via `ALTER TABLE`; create `backend/src/db/migrations/001_budget_alert_timestamps.sql`
2. **`GET /api/budget/settings`** — returns `budget_settings` rows for dealership; includes current `spent` from `metrics_cache` for current month, progress %, projected month-end spend
3. **`PUT /api/budget/settings`** — upsert monthly cap + alert preferences per platform
4. **`POST /api/budget/pause-all`** — requires confirmation token in body; pauses all `active` campaigns on both platforms; updates DB; returns count paused
5. **Budget monitoring cron** — `backend/src/cron/monitor-budget.ts` — runs every 15 minutes; computes `monthSpend / monthlyCap` per dealership; fires alerts only once per threshold crossing per month (tracks `alert_75_sent_at`, `alert_95_sent_at` in `budget_settings`)
6. **Email alert service** — `backend/src/services/email.ts` — writes alert HTML to console/log file locally; interface matches SendGrid for later swap
7. **SMS alert service** — `backend/src/services/sms.ts` — logs SMS content locally; same swap pattern
8. **Monthly reset cron** — runs on 1st of month: zeroes `alert_75_sent_at` and `alert_95_sent_at`
9. **Budget page wiring** — `frontend/app/dashboard/budget/page.tsx` fetches real settings; progress bars colour-shift at 75% (yellow) and 90% (red); projected spend shown; cap inputs save on blur; "Pause All" shows confirmation dialog before API call

### Files Created/Modified

| File | Action |
|------|--------|
| `backend/src/db/migrations/001_budget_alert_timestamps.sql` | Create — adds alert tracking columns to budget_settings |
| `backend/src/routes/budget.ts` | Create — all budget routes |
| `backend/src/services/alert-service.ts` | Create — threshold detection + alert dispatch |
| `backend/src/services/email.ts` | Create — local console email stub |
| `backend/src/services/sms.ts` | Create — local console SMS stub |
| `backend/src/cron/monitor-budget.ts` | Create — 15-min spend monitor |
| `frontend/app/dashboard/budget/page.tsx` | Modify — wire real data, all interactions |

### Tests

- **Unit:** threshold crossing detection (fires once, not repeatedly), projected spend calculation, monthly reset logic
- **API:** GET/PUT settings, pause-all with + without confirmation token, unauthenticated rejection

---

## Phase 3b: Reports Agent

**Entry condition:** Phases 1 + 2 complete; metrics_cache has at least one week of data.
**Exit condition:** Report cron generates correctly, PDF saves locally, full report visible in UI, "Send Now" works on demand.

### Tasks

1. **Report generation service** — `backend/src/services/report-generator.ts` — reads prior week's `metrics_cache` rows (Mon–Sun), computes totals + WoW comparison, generates insight sentence using template strings (e.g. `"Your {{topCampaign}} campaign delivered leads at ₹{{cpl}} CPL — {{delta}}% better than last week"`)
2. **PDF generator** — `backend/src/services/pdf-generator.ts` — builds HTML report, uses `html-pdf-node` to render PDF, saves to `reports/` folder locally; returns file path
3. **Email report service** — `backend/src/services/email-reports.ts` — writes inline HTML to `reports/sent/` folder locally and logs attachment path; SendGrid-interface-compatible
4. **Weekly report cron** — `backend/src/cron/weekly-report.ts` — fires every Monday at 08:00 IST (`0 30 2 * * 1` UTC); runs full pipeline: generate → PDF → email → save report row to DB
5. **`GET /api/reports`** — returns past 12 report records for dealership, most recent first
6. **`GET /api/reports/:id`** — returns full report detail including insight text, all metrics, top campaign
7. **`POST /api/reports/send-now`** — generates report for last complete week, runs full pipeline, returns report record
8. **Reports page wiring** — `frontend/app/dashboard/reports/page.tsx` fetches real report list; each card shows period, spend, leads, CPL; click opens full report view with insight at top; "Send Now" triggers API call with loading state

### Files Created/Modified

| File | Action |
|------|--------|
| `backend/src/services/report-generator.ts` | Create — metric aggregation + insight generation |
| `backend/src/services/pdf-generator.ts` | Create — HTML to PDF via html-pdf-node |
| `backend/src/services/email-reports.ts` | Create — local report email stub |
| `backend/src/cron/weekly-report.ts` | Create — Monday 8AM IST cron |
| `backend/src/routes/reports.ts` | Create — list + detail + send-now |
| `frontend/app/dashboard/reports/page.tsx` | Modify — wire real data, report viewer |

### Tests

- **Unit:** metric aggregation (correct week range boundary), WoW delta directions (better/worse/neutral), insight sentence generator, PDF file creation
- **API:** GET reports list, GET report detail, POST send-now (triggers generation + saves record)

---

## Phase 4: Test Suite Agent

**Entry condition:** All 6 feature agents complete and passing their own unit/API tests.
**Exit condition:** All tests pass, all Playwright E2E flows complete without errors, coverage report shows no service file below 80%.

### Tasks

1. **Unit test audit** — review coverage across all service files; fill gaps to reach >80% coverage on services layer
2. **Supertest integration suite** — `backend/tests/integration/` — for every route: authenticated happy path, unauthenticated rejection (401), invalid params (400), not-found (404); uses `ai_ad_manager_test` DB seeded before each suite
3. **Playwright E2E tests** — `frontend/tests/e2e/`:
   - `auth.spec.ts` — login → redirect to settings (no account) or dashboard (account connected)
   - `campaigns.spec.ts` — select template → fill form → preview → publish → appears in list → pause → resume
   - `leads.spec.ts` — leads in inbox → click → reveal phone → change status → add note → export CSV
   - `budget.spec.ts` — set cap → progress bar updates → pause all → confirmation dialog
   - `reports.spec.ts` — list loads → open report → view insight → send now
4. **Coverage report** — `jest --coverage`; output to `backend/coverage/`

### Files Created

| File | Purpose |
|------|---------|
| `backend/tests/integration/auth.test.ts` | Auth route integration tests |
| `backend/tests/integration/campaigns.test.ts` | Campaign route integration tests |
| `backend/tests/integration/leads.test.ts` | Lead route integration tests |
| `backend/tests/integration/budget.test.ts` | Budget route integration tests |
| `backend/tests/integration/reports.test.ts` | Reports route integration tests |
| `backend/tests/integration/dashboard.test.ts` | Dashboard route integration tests |
| `frontend/tests/e2e/auth.spec.ts` | Playwright auth flow |
| `frontend/tests/e2e/campaigns.spec.ts` | Playwright campaign flow |
| `frontend/tests/e2e/leads.spec.ts` | Playwright lead inbox flow |
| `frontend/tests/e2e/budget.spec.ts` | Playwright budget flow |
| `frontend/tests/e2e/reports.spec.ts` | Playwright reports flow |

---

## Dependency Chain

```
Phase 1 Foundation
  └── auth.ts (NextAuth callbacks)
  └── middleware/auth.ts
  └── integrations.ts (OAuth flows)
      │
      ├── Phase 2a Dashboard     (needs: auth + ad_accounts tokens)
      ├── Phase 2b Campaigns     (needs: auth + ad_accounts tokens)
      └── Phase 2c Lead Inbox    (needs: auth + ad_accounts tokens)
              │
              ├── Phase 3a Budget   (needs: campaigns + metrics_cache)
              └── Phase 3b Reports  (needs: metrics_cache with 1 week of data)
                      │
                      └── Phase 4 Test Suite (needs: all features complete)
```

---

## Shared Interfaces

All adapter services return the same normalized shape so the aggregator is platform-agnostic:

```typescript
interface NormalizedMetric {
  platform: 'google' | 'meta'
  campaignId: string
  campaignName: string
  date: string        // YYYY-MM-DD
  spend: number       // in INR
  impressions: number
  clicks: number
  leads: number
}

interface NormalizedLead {
  platformLeadId: string
  platform: 'google' | 'meta'
  campaignId: string
  name: string
  phone: string
  email: string
  receivedAt: string  // ISO timestamp
}
```

---

## Local Dev Startup

```bash
# Terminal 1 — Backend
cd backend && npm run dev        # nodemon on port 4000

# Terminal 2 — Frontend
cd frontend && npm run dev       # Next.js on port 3000

# Terminal 3 — DB
psql -U postgres -c "CREATE DATABASE ai_ad_manager_dev;"
cd backend && npx ts-node src/db/migrate.ts
```
