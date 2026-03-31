# Stage 4: UX / Design Requirements
## AI Ad Manager — Screen-by-Screen Breakdown

---

## Design Style
- **Style:** Clean, data-forward, professional — similar to Google Analytics meets Zoho
- **Feel:** Confident, simple, trustworthy (dealers are non-technical)
- **Colour palette:** Deep navy + white + green accents (green = good performance)
- **Typography:** Inter or DM Sans — readable at all sizes
- **Inspiration:** Zoho Marketing Hub, HubSpot Dashboard, Google Looker Studio (simplified)
- **Mobile-first:** Dealer Principals check on phone — every screen works on mobile

---

## Navigation Flow

```
Login
  └── Dashboard (home)
        ├── Campaigns → Campaign List → Campaign Detail
        │                └── New Campaign → Template Select → Form → Preview → Publish
        ├── Lead Inbox → Lead Detail
        ├── Budget Manager
        ├── Reports
        └── Settings → Connect Accounts
```

---

## Screen 1: Login / Signup

**Purpose:** Authenticate dealer and connect ad accounts on first use

**Key Elements:**
- Logo + tagline: "Ad management built for car dealers"
- "Sign in with Google" button (primary — reduces friction)
- Email + password fallback
- "Request Demo" link for leads who aren't ready

**User Actions:**
- Sign in → lands on Dashboard
- First-time user → prompted to connect Google Ads + Meta accounts immediately after login

**UX Principles:**
- One primary action only — no clutter
- Google sign-in reduces password friction (dealers are on Gmail)

---

## Screen 2: Dashboard (Home)

**Purpose:** Give Dealer Principal instant visibility into ad performance across both platforms

**Key Elements:**
- Top bar: Date range selector (Today / This Week / This Month / Custom)
- 4 KPI cards: Total Spend | Total Leads | Cost Per Lead | Active Campaigns
- Platform split bar: Google spend vs Meta spend (visual bar)
- Leads trend chart (last 7 or 30 days line graph)
- Top performing campaign card (name, leads, CPL)
- Quick actions: "Launch New Campaign" button (always visible)
- Alert banner if budget nearing limit

**User Actions:**
- Change date range → all cards update
- Click KPI card → drills into detail
- Click "Launch New Campaign" → goes to Campaign Launcher

**UX Principles:**
- Most important number (Leads + CPL) is largest on screen
- No numbers without context — always show vs last period (↑ 12%)
- Mobile: KPI cards stack vertically, chart below

---

## Screen 3: Campaign Launcher — Template Select

**Purpose:** Remove blank-canvas anxiety — dealer picks a template, not starts from scratch

**Key Elements:**
- Grid of template cards (2 columns mobile, 4 desktop):
  - 🚗 Model Launch
  - 🧪 Test Drive Offer
  - 🔁 Exchange Offer
  - 🎉 Festive Sale
  - 📅 Year-End Clearance
  - ➕ Custom (blank)
- Each card shows: template name, typical use case, example ad preview thumbnail

**User Actions:**
- Click template → goes to Campaign Form

**UX Principles:**
- Visual cards over dropdowns — dealer can see what they're picking
- "Most used" tag on top 2 templates
- Custom option always available but not promoted

---

## Screen 4: Campaign Launcher — Form

**Purpose:** Collect campaign details and publish to Google + Meta in one action

**Key Elements:**
- Step indicator: Details → Preview → Publish (3 steps, shown at top)
- **Step 1 — Details form:**
  - Car Model (text input with autocomplete: Maruti Swift, Hyundai Creta, etc.)
  - Offer Headline (pre-filled from template, editable)
  - Budget (₹ input) + Duration (date picker: start → end)
  - Target Location (map radius picker or city name)
  - Platform toggle: Google ✅ | Meta ✅ (both on by default)
- **Step 2 — Preview:**
  - Shows preview of Google Search Ad (headline, description)
  - Shows preview of Meta Feed Ad (image placeholder + copy)
  - "Edit" option on each
- **Step 3 — Publish:**
  - Summary: campaign name, budget, dates, platforms
  - "Go Live" button (green, prominent)
  - Estimated reach shown (pulled from APIs)

**User Actions:**
- Fill form → Next → Preview → Edit if needed → Go Live → Confirmation screen

**UX Principles:**
- Progress steps reduce overwhelm
- Pre-filled defaults from template — dealer changes minimum fields
- "Go Live" is the only primary action on last step

---

## Screen 5: Campaign List

**Purpose:** Overview of all campaigns — active, paused, completed

**Key Elements:**
- Filter tabs: All | Active | Paused | Completed
- Campaign cards (list view): name, platform icons, spend to date, leads, CPL, status badge, date range
- Pause/Resume toggle on each card
- "New Campaign" button (top right, always visible)

**User Actions:**
- Toggle pause/resume → instant feedback
- Click campaign → goes to Campaign Detail
- Filter by status

**UX Principles:**
- Status badges colour-coded: green (active), gray (paused), blue (completed)
- Most recent campaign at top by default

---

## Screen 6: Lead Inbox

**Purpose:** Single place to see and manage all leads from both platforms

**Key Elements:**
- Lead list (left panel on desktop, full screen on mobile):
  - Lead name, phone number masked (show on click), source icon (G/Meta), campaign name, time ago
  - Status colour dot: New (blue) / Contacted (yellow) / Qualified (green) / Lost (red)
- Lead Detail panel (right panel on desktop, new screen on mobile):
  - Full name, phone (tap to call on mobile), email
  - Source: which platform + which campaign + which ad
  - Timestamp
  - Status dropdown
  - Notes field (free text)
- Top bar: search, filter by source/status, Export CSV button

**User Actions:**
- Click lead → view details
- Change status → auto-saved
- Tap phone number on mobile → opens dialler
- Export → downloads CSV

**UX Principles:**
- Leads sorted by newest first — dealer sees freshest leads immediately
- Phone tap-to-call is critical on mobile (most action happens on phone)
- "New" leads badge count shown in nav sidebar

---

## Screen 7: Budget Manager

**Purpose:** Give dealer full control of ad spend with alerts

**Key Elements:**
- Per-platform budget cards: Google budget | Meta budget
  - Set monthly cap (₹ input)
  - Progress bar: spent vs cap (colour changes: green → yellow at 75% → red at 90%)
  - Projected month-end spend (based on daily rate)
- Alert Settings: toggle email alert at 75% / 95%, SMS alert toggle
- Emergency "Pause All Campaigns" button (red, bottom of page — visible but not prominent)

**User Actions:**
- Edit budget cap → save → immediate effect
- Toggle alert preferences
- Pause all → confirmation dialog → all campaigns paused

**UX Principles:**
- Progress bars make budget feel visual and tangible
- Red "Pause All" button exists but requires confirmation — prevents accidental pauses
- Projected spend helps dealer plan ahead

---

## Screen 8: Reports

**Purpose:** Automated weekly performance summary for Dealer Principal

**Key Elements:**
- Report list (past 12 weeks shown)
- Each report card: week dates, total spend, leads generated, CPL, top campaign
- Click → opens full report in clean readable format
- "Send Now" button (re-sends latest report to email)
- Report content: same KPIs + charts + campaign table + one-line insight (e.g. "Your test drive campaign generated leads at ₹340 CPL — 28% better than last week")

**User Actions:**
- Browse past reports
- Click to open full report
- Re-send to email

**UX Principles:**
- Reports written in plain language — no jargon
- Insight sentence at top tells dealer the most important takeaway immediately

---

## Screen 9: Settings — Connect Accounts

**Purpose:** OAuth connection to Google Ads and Meta Business accounts

**Key Elements:**
- Two connection cards: Google Ads | Meta Ads
- Status: Connected ✅ | Not Connected ⚠️
- Connect button → OAuth flow opens in new window → returns to settings on success
- Connected account name + ad account shown after connection
- Disconnect option (with warning)

**User Actions:**
- Click Connect → OAuth flow → return → connected state shown
- Disconnect → warning dialog → disconnected

**UX Principles:**
- Show exactly what permissions are requested and why — builds trust
- Clear success state after connection (green checkmark, account name)

---

## Mobile-First Considerations
- Dashboard KPI cards: 2x2 grid on mobile
- Campaign Launcher: full-screen steps (one step per screen on mobile)
- Lead Inbox: full-screen list, tap lead → full-screen detail
- Budget bars: full width on mobile
- Bottom navigation bar on mobile (Dashboard / Leads / Campaigns / Budget)
- All tap targets minimum 44px height

---

## Performance Requirements
- Dashboard loads in under 2 seconds (cached data, refresh on demand)
- Campaign publish flow: show loading state, confirm within 10 seconds
- Lead inbox: paginated (50 leads per page), instant filter
- Reports: pre-generated, open instantly (not generated on click)
