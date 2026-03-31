# Stage 5: Product Requirements Document (PRD)
## AI Ad Manager

---

## 1. Overview

**Product:** AI Ad Manager
**Summary:** A SaaS platform for Indian car dealerships to manage Google and Meta advertising campaigns from a single dashboard — replacing agency dependency with self-serve tooling built for Dealer Principals.
**Goals:**
- Enable any dealership to launch, manage, and optimise Google + Meta campaigns without an agency
- Provide Dealer Principals with real-time visibility into ad spend and lead performance
- Capture all leads from both platforms into a single unified inbox
- Deliver automated weekly reports in plain language

---

## 2. User Personas

**Primary — Dealer Principal (Santosh, 45, owns 2 Maruti dealerships in Pune)**
- Spends ₹80K/month on digital ads through an agency
- Receives a monthly report, doesn't understand it
- Core need: "Tell me how many leads I got and what it cost me"
- Device: iPhone, checks dashboard between customer meetings

**Secondary — In-house Marketing Executive (Priya, 27, works at the dealership)**
- Manages day-to-day campaign changes
- Currently switches between Google Ads Manager + Meta Ads Manager
- Core need: "One place to do everything so I don't miss leads"
- Device: Laptop primarily, phone secondarily

---

## 3. Problem Statement
Indian car dealerships spend ₹50K–₹5L/month on digital advertising through agencies or untrained in-house teams. There is no India-specific, dealer-first platform to manage Google + Meta campaigns in one place. Dealer Principals have no real-time visibility, no budget controls, and no unified lead management — resulting in budget waste, missed leads, and zero accountability.

---

## 4. Features

### Feature 1: Unified Performance Dashboard

**Description:** A single screen displaying aggregated performance metrics from Google Ads and Meta Ads accounts connected to the dealership.

**User Story:**
As a Dealer Principal, I want to see my total ad spend, total leads, and cost per lead across Google and Meta in one screen, so that I can instantly understand how my ad budget is performing without logging into two platforms.

**Acceptance Criteria:**
- Dashboard loads within 2 seconds
- Shows: Total Spend, Total Leads, Cost Per Lead, Active Campaigns count
- Platform split view: Google vs Meta spend breakdown
- Date filter: Today / This Week / This Month / Custom date range
- Leads trend line chart for selected period
- Top performing campaign card (by leads generated)
- Alert banner appears if any campaign's budget is above 75% consumed
- All metrics update when date range is changed
- Dashboard is fully functional on mobile (375px width minimum)

---

### Feature 2: Campaign Launcher with Templates

**Description:** A guided campaign creation flow using pre-built India auto-specific templates that publish campaigns simultaneously to Google Ads and Meta Ads.

**User Story:**
As a marketing executive, I want to launch a campaign using a ready-made template for a test drive offer, so that I don't have to configure both Google and Meta separately from scratch.

**Acceptance Criteria:**
- Minimum 5 templates available: Model Launch, Test Drive, Exchange Offer, Festive Sale, Year-End Clearance
- Each template pre-fills: headline, description, call-to-action
- Form requires: car model name, offer text (editable), budget (₹), start date, end date, target location (city or radius)
- Platform toggle: user can choose Google only, Meta only, or both
- Preview screen shows rendered Google Search Ad + Meta Feed Ad before publishing
- "Go Live" action publishes campaign to selected platforms via API
- Confirmation screen shown with campaign ID and estimated reach
- Campaign appears in Campaign List within 60 seconds of publishing
- If API call fails, user sees specific error message and can retry

---

### Feature 3: Unified Lead Inbox

**Description:** All leads generated from Google Lead Forms and Meta Lead Ads are ingested into a single inbox with source attribution and status management.

**User Story:**
As a Dealer Principal, I want all my Google and Meta leads in one place with the campaign they came from, so that my team doesn't miss any enquiry and I can track follow-up.

**Acceptance Criteria:**
- Leads from Google Lead Form Extensions and Meta Instant Forms pulled via API within 5 minutes of form submission
- Each lead record shows: full name, phone number, email, source platform, campaign name, ad name, timestamp
- Phone number masked by default; revealed on click/tap
- Lead status options: New / Contacted / Qualified / Lost (dropdown, auto-saved on change)
- Free-text notes field per lead (auto-saved)
- Search by name or phone number
- Filter by: source platform, status, date range, campaign
- Export all filtered leads as CSV
- "New leads" count badge shown in navigation

---

### Feature 4: Budget Manager

**Description:** Per-platform monthly budget caps with real-time spend tracking and automated alerts.

**User Story:**
As a Dealer Principal, I want to set a monthly spending limit for Google and Meta separately, and get notified before I overspend, so that I never go over my planned budget.

**Acceptance Criteria:**
- Dealer can set individual monthly budget caps for Google and Meta (in ₹)
- Real-time spend progress bar per platform (updated every 15 minutes via API)
- Spend projection calculated: (spend to date / days elapsed) × days in month
- Email alert sent when spend reaches 75% of cap
- Email + SMS alert sent when spend reaches 95% of cap
- "Pause All Campaigns" button: requires confirmation dialog, then pauses all active campaigns on both platforms via API
- Budget resets on 1st of each month automatically
- Alert email/SMS preferences configurable in Settings

---

### Feature 5: Weekly Performance Reports

**Description:** Auto-generated weekly report summarising ad performance, delivered to the Dealer Principal by email every Monday morning.

**User Story:**
As a Dealer Principal, I want to receive a simple weekly summary of my ad performance in my email, so that I can review my results without logging into the platform.

**Acceptance Criteria:**
- Report generated automatically every Monday at 8:00 AM IST
- Report covers: Mon–Sun of previous week
- Report content: total spend, total leads, CPL, platform breakdown, top campaign, week-on-week comparison
- One plain-language insight sentence generated (e.g. "Your Exchange Offer campaign delivered leads at ₹290 CPL — 18% better than last week")
- Report delivered via email as both inline HTML and downloadable PDF attachment
- "Send Now" button in Reports screen re-sends latest report to registered email
- Past 12 weeks of reports stored and accessible in Reports screen

---

## 5. End-to-End User Flow

```
Signup → Connect Google Ads account (OAuth) → Connect Meta account (OAuth)
→ Dashboard shows (empty state with guidance)
→ Launch Campaign → Select Template → Fill Form → Preview → Go Live
→ Dashboard populates with live data
→ Leads appear in Inbox → Team tags leads
→ Budget alert sent at 75%
→ Monday: Weekly report in email
→ Dealer Principal reviews dashboard + report weekly
```

---

## 6. Metrics

**North Star Metric:** Number of active paying dealerships running at least 1 campaign per month

**Supporting KPIs:**

| KPI | Target (Month 3) |
|-----|-----------------|
| Activation rate (account connected + campaign launched within 7 days) | >60% |
| Month 2 retention | >70% |
| MRR | ₹2,00,000 (20 dealers × ₹10K) |
| Average campaigns per dealer per month | >2 |
| Lead inbox usage (>50% of leads tagged) | >50% |
| NPS from Dealer Principals | >40 |

---

## 7. Edge Cases

- **Google/Meta API rate limits:** Implement retry logic with exponential backoff; show user "syncing" state
- **OAuth token expiry:** Detect expired tokens, prompt user to re-authenticate with clear message
- **Zero leads returned:** Show empty state with guidance ("Your campaign is running — leads will appear here once someone submits the form")
- **Campaign creation failure (API error):** Show error message with specific reason; do not charge/deduct budget; allow retry
- **Dealer disconnects ad account:** Pause data sync, show warning banner, prompt reconnection
- **Multiple users on same account:** Role-based: Owner (full access) + Staff (no billing, no Settings)
- **Indian number format:** All currency displayed in ₹ with Indian comma formatting (₹1,00,000)
- **Timezone:** All timestamps in IST (UTC+5:30)

---

## 8. Dependencies

| Dependency | Risk | Mitigation |
|-----------|------|-----------|
| Google Ads API partner approval | High — takes 2–4 weeks | Apply on Day 1 of development |
| Meta Marketing API business verification | Medium — 3–7 days | Apply on Day 1 |
| SendGrid email delivery | Low | Backup: AWS SES |
| Twilio SMS (alerts) | Low | Backup: MSG91 (India-specific) |
| Google OAuth for login | Low | Standard library |

---

## 9. Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Google/Meta API approval delayed | Medium | High — blocks campaign launch feature | Build dashboard and lead inbox first; launch API feature in Phase 2 |
| Dealers unwilling to share ad account access | Medium | High | Build trust through demo + data privacy policy; offer managed onboarding |
| Agency pushback / bad reviews | Low | Medium | Focus on direct sales to Dealer Principals, bypass agency |
| Low digital literacy slows adoption | High | Medium | In-app guided tour, video tutorials, WhatsApp support |
| Competitor launches India-specific product | Low | High | Move fast; lock in early dealers with annual contracts |
