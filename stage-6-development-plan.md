# Stage 6: Development Plan
## AI Ad Manager — Engineering Instructions

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14 (React) | SSR for performance, great DX, Vercel deploy |
| Styling | Tailwind CSS | Fast UI, mobile-first |
| Backend | Node.js + Express | Fast API layer, good Google/Meta SDK support |
| Database | PostgreSQL (via Supabase) | Relational, free tier, built-in auth option |
| Auth | NextAuth.js + Google OAuth | One-click Google login, session management |
| Ad APIs | Google Ads API + Meta Marketing API | Core integrations |
| Email | SendGrid | Transactional email + report delivery |
| SMS | MSG91 | India-specific, reliable, WhatsApp-ready later |
| Scheduling | node-cron | Weekly report generation |
| Hosting | Vercel (frontend) + Railway (backend) | Free tiers, easy deploy |
| File storage | Supabase Storage | PDF report storage |

---

## Architecture Overview

```
Browser (Next.js)
      │
      ▼
API Layer (Express on Railway)
      ├── /auth         → NextAuth + Google OAuth
      ├── /campaigns    → Create/pause/list campaigns
      ├── /leads        → Ingest + manage leads
      ├── /dashboard    → Aggregate metrics
      ├── /budget       → Budget caps + alerts
      ├── /reports      → Generate + fetch reports
      └── /integrations → Google Ads API + Meta API adapters
            │
            ├── Google Ads API
            ├── Meta Marketing API
            ├── SendGrid
            └── MSG91

Database (PostgreSQL via Supabase)
      ├── users
      ├── dealerships
      ├── ad_accounts
      ├── campaigns
      ├── leads
      ├── budget_settings
      └── reports
```

---

## Module Breakdown

### Module 1: Authentication

**Tasks:**
1. Set up Next.js project with NextAuth.js
2. Configure Google OAuth provider (Client ID + Secret from Google Cloud Console)
3. Create session middleware for API protection
4. Create user table in Supabase on first login
5. Build login page UI (Google sign-in button)
6. Redirect to dashboard post-login; redirect to onboarding if no ad account connected

**APIs:**
- `POST /auth/session` — create/verify session
- `GET /auth/me` — get current user + dealership info

**Data Models:**
```sql
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'owner',  -- owner | staff
  dealership_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
)

dealerships (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

### Module 2: Ad Account Connections

**Tasks:**
1. Build Google Ads OAuth flow (separate from login OAuth — needs Ads API scope)
2. Build Meta Business OAuth flow (Meta App → Business Login)
3. Store encrypted access tokens in DB
4. Build "Connect Accounts" settings screen
5. Handle token refresh (Google tokens expire after 1 hour)
6. Detect disconnected/expired tokens and surface warning to user

**APIs:**
- `GET /integrations/google/auth-url` — returns Google Ads OAuth URL
- `POST /integrations/google/callback` — exchanges code for tokens
- `GET /integrations/meta/auth-url` — returns Meta OAuth URL
- `POST /integrations/meta/callback` — exchanges code for tokens
- `DELETE /integrations/:platform` — disconnect account

**Data Models:**
```sql
ad_accounts (
  id UUID PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id),
  platform TEXT NOT NULL,  -- 'google' | 'meta'
  platform_account_id TEXT NOT NULL,
  account_name TEXT,
  access_token TEXT NOT NULL,  -- encrypted
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected_at TIMESTAMP DEFAULT NOW()
)
```

---

### Module 3: Dashboard & Metrics

**Tasks:**
1. Build Google Ads API adapter — fetch campaign metrics (spend, impressions, clicks, leads) via Google Ads Query Language (GAQL)
2. Build Meta Ads API adapter — fetch campaign insights via Graph API
3. Create aggregation service: combine metrics from both platforms
4. Cache results in DB (refresh every 15 minutes via cron)
5. Build dashboard API endpoint
6. Build Dashboard UI (KPI cards, chart, platform split, top campaign)

**APIs:**
- `GET /dashboard/metrics?period=week` — returns aggregated metrics
- `GET /dashboard/campaigns/top` — returns top performing campaign

**Data Models:**
```sql
metrics_cache (
  id UUID PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id),
  platform TEXT,
  date DATE,
  spend DECIMAL,
  impressions INTEGER,
  clicks INTEGER,
  leads INTEGER,
  cpl DECIMAL,
  cached_at TIMESTAMP DEFAULT NOW()
)
```

---

### Module 4: Campaign Launcher

**Tasks:**
1. Create campaign templates JSON (5 templates with pre-filled copy)
2. Build template selection UI (card grid)
3. Build campaign form UI (car model, offer, budget, dates, location, platform toggle)
4. Build ad preview component (Google Search Ad + Meta Card)
5. Build Google Ads campaign creation API call (campaign → ad group → ad → targeting)
6. Build Meta campaign creation API call (campaign → ad set → ad creative → ad)
7. Handle publish errors gracefully — show user-friendly error messages
8. Save campaign record to DB on success

**APIs:**
- `GET /campaigns/templates` — return all templates
- `POST /campaigns/create` — create campaign on selected platforms
- `GET /campaigns` — list all campaigns for dealership
- `PATCH /campaigns/:id/pause` — pause campaign
- `PATCH /campaigns/:id/resume` — resume campaign

**Data Models:**
```sql
campaigns (
  id UUID PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id),
  name TEXT NOT NULL,
  template_type TEXT,
  car_model TEXT,
  offer_text TEXT,
  budget DECIMAL,
  start_date DATE,
  end_date DATE,
  target_location TEXT,
  status TEXT DEFAULT 'active',  -- active | paused | completed | failed
  google_campaign_id TEXT,
  meta_campaign_id TEXT,
  platforms TEXT[],  -- ['google', 'meta']
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

### Module 5: Lead Inbox

**Tasks:**
1. Build Google Lead Form webhook receiver (or polling via API every 5 minutes)
2. Build Meta Lead Ads webhook receiver (Meta Graph API webhook)
3. Normalise lead data from both platforms into unified schema
4. Build lead list UI (sortable, filterable, paginated)
5. Build lead detail panel/screen
6. Build status update API (auto-save on change)
7. Build notes field (auto-save with 500ms debounce)
8. Build CSV export
9. Show new leads badge in nav

**APIs:**
- `GET /leads?status=new&platform=google&page=1` — paginated lead list
- `GET /leads/:id` — lead detail
- `PATCH /leads/:id` — update status or notes
- `GET /leads/export?format=csv` — CSV download
- `POST /webhooks/meta/leads` — Meta webhook receiver
- `POST /webhooks/google/leads` — Google webhook receiver (or polling endpoint)

**Data Models:**
```sql
leads (
  id UUID PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id),
  campaign_id UUID REFERENCES campaigns(id),
  platform TEXT NOT NULL,  -- 'google' | 'meta'
  platform_lead_id TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'new',  -- new | contacted | qualified | lost
  notes TEXT,
  received_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

### Module 6: Budget Manager

**Tasks:**
1. Build budget settings UI (per-platform cap input + progress bars)
2. Build budget update API
3. Build 15-minute cron: fetch actual spend from both APIs, compare to cap
4. Send email alert at 75% via SendGrid
5. Send email + SMS at 95% via SendGrid + MSG91
6. Build "Pause All" endpoint — calls pause on all active campaigns
7. Auto-reset budget tracking on 1st of each month

**APIs:**
- `GET /budget/settings` — get current caps and spend
- `PUT /budget/settings` — update caps
- `POST /budget/pause-all` — pause all active campaigns
- `GET /budget/alerts/preferences` — get alert settings
- `PUT /budget/alerts/preferences` — update alert settings

**Data Models:**
```sql
budget_settings (
  id UUID PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id),
  platform TEXT,
  monthly_cap DECIMAL,
  alert_75_email BOOLEAN DEFAULT TRUE,
  alert_95_email BOOLEAN DEFAULT TRUE,
  alert_95_sms BOOLEAN DEFAULT TRUE,
  phone_for_sms TEXT
)
```

---

### Module 7: Reports

**Tasks:**
1. Build report generation service (runs every Monday 8AM IST via node-cron)
2. Calculate week's metrics from DB (don't call APIs — use cached data)
3. Generate HTML email template (clean, mobile-friendly)
4. Generate PDF from HTML using puppeteer or html-pdf-node
5. Store PDF in Supabase Storage
6. Send email via SendGrid with inline HTML + PDF attachment
7. Build Reports screen (list + detail viewer)
8. Build "Send Now" endpoint

**APIs:**
- `GET /reports` — list past 12 reports
- `GET /reports/:id` — get report detail
- `POST /reports/send-now` — trigger immediate send of latest report

**Data Models:**
```sql
reports (
  id UUID PRIMARY KEY,
  dealership_id UUID REFERENCES dealerships(id),
  period_start DATE,
  period_end DATE,
  total_spend DECIMAL,
  total_leads INTEGER,
  cpl DECIMAL,
  top_campaign_id UUID,
  insight_text TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
)
```

---

## Folder Structure

```
ai-ad-manager/
├── frontend/                    ← Next.js app
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx         ← Dashboard
│   │   │   ├── campaigns/
│   │   │   ├── leads/
│   │   │   ├── budget/
│   │   │   ├── reports/
│   │   │   └── settings/
│   ├── components/
│   │   ├── ui/                  ← Reusable components
│   │   ├── dashboard/
│   │   ├── campaigns/
│   │   ├── leads/
│   │   └── charts/
│   └── lib/
│       ├── api.ts               ← API client
│       └── utils.ts
│
├── backend/                     ← Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js
│   │   │   ├── leads.js
│   │   │   ├── dashboard.js
│   │   │   ├── budget.js
│   │   │   ├── reports.js
│   │   │   └── integrations.js
│   │   ├── services/
│   │   │   ├── google-ads.js
│   │   │   ├── meta-ads.js
│   │   │   ├── report-generator.js
│   │   │   └── alert-service.js
│   │   ├── cron/
│   │   │   ├── sync-metrics.js
│   │   │   └── weekly-report.js
│   │   ├── db/
│   │   │   └── schema.sql
│   │   └── index.js
│   └── package.json
```

---

## Build Order (Critical Path)

| Priority | Module | Why First |
|----------|--------|-----------|
| 1 | Auth + Account Connection | Everything depends on connected accounts |
| 2 | Dashboard + Metrics | Core value — Dealer Principal sees this first |
| 3 | Lead Inbox | Immediate daily value for marketing team |
| 4 | Campaign Launcher | Requires API approval — start application now |
| 5 | Budget Manager | Builds trust — Dealer Principal cares deeply |
| 6 | Reports | Locks in weekly habit; requires data from modules 1–5 |

---

## Deployment Steps (Free Tools)

1. **Frontend → Vercel**
   - `vercel deploy` from `/frontend`
   - Set env vars: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `API_URL`

2. **Backend → Railway**
   - Connect GitHub repo → Railway auto-deploys
   - Set env vars: all API keys, DB URL, SendGrid key, MSG91 key

3. **Database → Supabase**
   - Create project → run `schema.sql`
   - Copy connection string to Railway env

4. **Apply for API Access (Day 1 — parallel to development)**
   - Google Ads API: [developers.google.com/google-ads/api/docs/get-started/oauth-cloud](https://developers.google.com/google-ads/api/docs/get-started/oauth-cloud)
   - Meta Marketing API: [developers.facebook.com/docs/marketing-apis](https://developers.facebook.com/docs/marketing-apis)

---

## Testing Approach

- **Unit tests:** Jest — test service functions (metric aggregation, report generation, alert logic)
- **API tests:** Supertest — test all Express routes with mock data
- **E2E tests:** Playwright — test critical flows (login → connect account → launch campaign → view leads)
- **Manual testing checklist before launch:** connect real accounts, launch test campaign with ₹100 budget, verify lead flows in, verify report sends, verify budget alert fires
