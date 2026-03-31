# Stage 3: MVP Document
## AI Ad Manager — Build Scope

---

## Product Overview
AI Ad Manager is a SaaS platform for Indian car dealerships that replaces agency dependency with a self-serve, unified Google + Meta ad management dashboard — built specifically for Dealer Principals who want control, visibility, and results without hiring experts.

---

## Target Users
- **Primary:** Dealer Principal (owner) — wants visibility and control
- **Secondary:** In-house marketing executive — executes campaigns daily

---

## Core Value Proposition
The only India-first ad management platform built for car dealers — run Google and Meta campaigns from one dashboard, capture all leads in one inbox, and see exactly what your ad budget is doing. Replace your agency at a fraction of the cost.

**Competitive edge reflected from market gaps:**
- No agency needed — self-serve with guardrails
- India auto-specific templates (model launches, festive, test drive)
- Unified lead inbox — Google + Meta in one place
- Real-time budget controls (competitors have none)

---

## MVP Scope

### Core Features (Prioritised)

**Feature 1 — Unified Performance Dashboard**
- Single screen showing: total spend, total leads, CPL (cost per lead), impressions, clicks
- Breakdowns: by platform (Google vs Meta), by campaign, by date range
- Mobile-responsive for Dealer Principal on the go

**Feature 2 — Campaign Launcher with Templates**
- Pre-built templates: Model Launch, Test Drive, Exchange Offer, Festive Sale, Year-End Clearance
- Dealer fills in: car model, offer text, budget, duration, target location radius
- Platform auto-creates the campaign on Google Ads + Meta Ads simultaneously
- Preview before publish

**Feature 3 — Unified Lead Inbox**
- All leads from Google Lead Forms + Meta Lead Ads flow into one inbox
- Each lead shows: name, phone, source (Google/Meta), campaign name, timestamp
- Status tagging: New / Contacted / Qualified / Lost
- CSV export

**Feature 4 — Budget Manager**
- Set monthly budget cap per platform
- Real-time spend tracker (% used)
- Alerts at 75% and 95% spend via email + SMS
- One-click pause all campaigns

**Feature 5 — Weekly Performance Report**
- Auto-generated every Monday morning
- Shows: week's spend, leads generated, CPL, best-performing campaign
- Delivered via email as PDF
- Simple language — designed for non-technical Dealer Principal

---

### User Flows

**Campaign Launch Flow:**
Login → Dashboard → "New Campaign" → Select Template → Fill Details (model, budget, dates, location) → Preview Ads → Connect Accounts (if first time) → Publish → Confirmation

**Lead Management Flow:**
Login → Lead Inbox → View new leads → Click lead → See details → Tag status → Export CSV

**Report Flow:**
Auto-triggered every Monday → Email sent to Dealer Principal → Click to view report in browser

---

### Key Screens
1. Dashboard (metrics overview)
2. Campaign Launcher (template selection + form)
3. Campaign List (active/paused/completed)
4. Lead Inbox
5. Lead Detail view
6. Budget Manager
7. Account Settings (connect Google/Meta accounts)
8. Reports (weekly report viewer)

---

## What is NOT in MVP
- AI-generated ad copy (Phase 2)
- Competitor intelligence (Phase 2)
- WhatsApp lead delivery (Phase 2)
- Multi-dealership group view (Phase 2)
- OEM co-op fund tracker (Phase 3)
- Automated bid optimisation (Phase 3)
- Video ad creation (Phase 3)
- CRM integration (Phase 3)

---

## Success Metrics

| Metric | Target (Month 3) |
|--------|-----------------|
| **Activation** | Dealer connects at least 1 ad account and launches 1 campaign within 7 days of signup |
| **Retention** | 70% of dealers active in Month 2 still active in Month 3 |
| **Revenue** | 20 paying dealers at ₹10K/month = ₹2L MRR |
| **NPS** | >40 from Dealer Principals |
| **Lead CPL** | Dealers achieve at least 20% better CPL vs their agency benchmark |

---

## Tech Considerations

### Suggested Stack
- **Frontend:** React.js (Next.js) — fast, SEO-friendly
- **Backend:** Node.js + Express — or Python FastAPI
- **Database:** PostgreSQL (relational — leads, campaigns, users)
- **Auth:** Firebase Auth or Auth0 (Google OAuth for easy login)
- **Ad Integrations:** Google Ads API + Meta Marketing API
- **Notifications:** SendGrid (email) + Twilio (SMS)
- **Hosting:** Vercel (frontend) + Railway or Render (backend) — free tiers available

### Key Integrations
- Google Ads API (requires Google Partner approval — start application now, takes 2–4 weeks)
- Meta Marketing API (requires Business Verification — start now)
- SendGrid for email reports
- Twilio for SMS budget alerts

---

## Week-by-Week MVP Timeline

| Week | Focus | Deliverables |
|------|-------|-------------|
| Week 1 | Setup + Auth + Google/Meta API connections | Project scaffold, login, account connect flow |
| Week 2 | Dashboard + data pipeline | Pull spend/impressions/leads from both APIs, display on dashboard |
| Week 3 | Campaign Launcher (templates) | Template UI, form → campaign creation on Google + Meta |
| Week 4 | Lead Inbox | Lead ingestion from both platforms, inbox UI, status tagging |
| Week 5 | Budget Manager + Alerts | Budget caps, spend tracking, email/SMS alerts |
| Week 6 | Reports + Polish + Testing | Auto-report generation, end-to-end testing, bug fixes, soft launch |
