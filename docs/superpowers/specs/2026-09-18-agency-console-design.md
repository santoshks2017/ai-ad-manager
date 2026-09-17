# AI Ad Manager — Agency Operations Console
**Date:** 2026-09-18
**Status:** Design approved for autonomous build (user authorized overnight implementation)
**Supersedes:** `2026-05-24-mvp-multi-agent-workplan-design.md` (self-serve dealer model — obsolete)

---

## 1. What changed, and why it matters

The previous design assumed a **self-serve SaaS**: each dealership signs up, connects *their own* Google and Meta ad accounts via OAuth, and manages their own campaigns. Every architectural decision flowed from that — per-tenant OAuth, per-tenant token refresh, `dealership_id` scoping on user sessions, dealer-facing UI.

That model is now explicitly dead. The confirmed model is:

> An **internal tool** used by CarDekho account managers to set up, run, optimise and deliver campaigns for dealer clients. Campaigns run on **our own** Google Ads MCC and Meta Business Manager. Dealers have no platform accounts, no logins, and no technical involvement of any kind.

This is not a small change. It removes the single largest source of complexity in the old design and replaces it with a different one.

**What disappears:**
- Per-dealer OAuth flows and consent screens
- Per-dealer token storage, encryption, refresh, and expiry handling
- Dealer-facing authentication and session scoping
- The "dealer disconnects their account" failure mode
- Google Ads API *Required Minimum Functionality* compliance (RMF explicitly exempts internal/agency-use tools with no third-party access)

**What appears:**
- Dealers become **records**, not tenants. There is one tenant: us.
- Campaign→dealer attribution inside shared ad accounts becomes load-bearing. Get this wrong and a dealer is billed for another dealer's spend.
- Blast radius: a policy strike on a shared ad account affects every dealer in it.
- A **sales-facing projection tool** — a new first-class subsystem with no equivalent in the old design.

---

## 2. Scope

### In scope
1. **Dealer registry** — dealer records, contracted budget, committed CPL, assigned virtual number, landing page URL, LMS account reference.
2. **Projection engine** — sales inputs budget + city + model + objective; system returns an estimated CPL range and deliverable lead count, in seconds rather than hours.
3. **Activation workflow** — sales submits a confirmed order; marketing receives it as an activation queue item.
4. **Campaign console** — account managers create and manage Google and Meta campaigns for dealers from one screen.
5. **Performance layer** — per-dealer metrics, normalised across both platforms.
6. **Optimisation engine** — continuous observation, batched intervention, account-manager approval on anything material.

### Explicitly out of scope
- **Landing pages** — built and hosted elsewhere. We store a URL.
- **Virtual numbers** — provisioned elsewhere. We store the assigned number.
- **Lead management system** — separate product. Leads flow LP/VN → LMS directly, never through this tool.
- **Dealer-facing portal** — covered by the separate Dealer Campaign Portal PRD. Not built here.
- **Platforms beyond Google and Meta** — LinkedIn, X, TikTok deferred. (LinkedIn in particular is a months-long partner-gated approval and cannot serve hundreds of accounts; see research notes.)
- **Self-serve** — a later phase, and one that re-introduces RMF compliance.

---

## 3. Architecture

### 3.1 Stack decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | **Cloud Run**, single service | User-specified. One service for app + API is simpler and cheaper than two. |
| App framework | **Next.js (App Router)** | Already in the repo. Route handlers replace the Express backend entirely — the Express layer was ~95% mocks, so little is lost. |
| Database | **Firestore** | Free tier (explicit constraint). Serverless-native — avoids the Postgres connection-pool problems Cloud Run creates. Cloud SQL has no free tier. |
| Auth | **Firebase Auth** | Internal users only. Google sign-in restricted to our domain. |
| Data access | **Repository layer** | Isolates Firestore behind interfaces so the store is swappable if relational aggregation later wins. |

**Firestore trade-off, stated honestly:** the domain is relational and Firestore is not. The mitigation is precomputed daily rollup documents rather than aggregation-on-read. This is the standard pattern and it is adequate here, but if metrics queries grow more complex than "sum by dealer by day", Postgres becomes the better answer. The repository layer exists so that migration is a contained change.

### 3.2 The provider abstraction — and an explicit anti-pattern fix

The previous codebase set `SANDBOX_MODE=true` and had `GoogleAdsService.createCampaign()` return `g_camp_${random}` — a fabricated ID, returned silently, indistinguishable downstream from a real one. That is a trap: it lets fake data masquerade as real and makes "is this working?" unanswerable.

This build replaces that with an explicit two-implementation provider:

```
AdProvider (interface)
├── GoogleAdsProvider    — real Google Ads API calls
├── MetaAdsProvider      — real Meta Marketing API calls
└── SimulatedProvider    — deterministic synthetic data
```

Rules, enforced in the data model rather than by convention:
- Every persisted record carries a `provenance` field: `live` | `simulated`.
- Simulated records are visibly marked in the UI. Always. There is no configuration that hides this.
- The two can never be silently mixed in an aggregate. A rollup spanning both is labelled as such or refused.
- Simulated is the default until real credentials exist, and the app states which mode it is in on every screen that shows platform data.

**Current credential status:** no Google Ads developer token and no Meta app credentials exist yet. The live providers are written against the documented APIs but are **unverified against a real endpoint**. They must not be described as working until exercised against live credentials.

### 3.3 Campaign→dealer attribution

Campaigns for many dealers share our ad accounts. Attribution is therefore structural, not incidental:

- **Naming convention**, enforced in code, not by human discipline:
  `{dealerCode}__{brand}__{model}__{objective}__{yyyymm}`
- **Platform labels** applied at campaign level (Google Ads labels; Meta campaign-level naming plus ad-set naming).
- **Local mapping table** is the source of truth: `campaign.dealerId` links every platform campaign ID back to a dealer.
- Reconciliation job flags any campaign in our accounts with no dealer mapping — an unmapped campaign means unattributed spend, which is a billing defect.

### 3.4 Data model (Firestore collections)

```
users/            {id, email, name, role: sales|account_manager|admin, active}
dealers/          {id, code, name, city, state, brands[], models[],
                   monthlyBudget, committedCpl, virtualNumber,
                   landingPageUrl, lmsAccountRef, status, ownerId, createdAt}
projections/      {id, input{budget,city,model,objective,brand},
                   output{cplLow,cplHigh,leadsLow,leadsHigh,confidence,
                          basis,platformSplit}, createdBy, createdAt}
orders/           {id, projectionId, dealerId, status: draft|submitted|
                   activated|rejected, submittedBy, activatedBy, notes, timestamps}
campaigns/        {id, dealerId, platform, platformCampaignId, name, objective,
                   dailyBudget, status, provenance, createdBy, createdAt}
metricsDaily/     {id: dealerId_platform_date, dealerId, platform, date,
                   spend, impressions, clicks, leads, provenance}
optimizations/    {id, campaignId, dealerId, kind, rationale, proposedChange,
                   status: proposed|approved|applied|rejected, decidedBy, timestamps}
benchmarks/       {id: city_brand_model_objective, cplLow, cplHigh, ctr,
                   convRate, sampleSize, source, updatedAt}
```

---

## 4. The projection engine

This is the highest-value subsystem, because it is the one that removes a documented, painful manual bottleneck: today a marketing manager researches each request by hand and the sales team waits hours. It is also the only major subsystem that delivers full value **without any ad-platform API access**, which makes it the right thing to build first.

### 4.1 Requirement
Sales inputs: **budget**, **city**, **car model** (and brand), **objective**. System returns, in seconds: an **estimated CPL range**, an **estimated lead count range**, a **confidence level**, and a **recommended Google/Meta split** — good enough to quote to a dealer across the table.

### 4.2 Estimation model

Estimate lead volume as budget divided by cost per lead, with CPL derived per platform and then blended by spend share:

```
leads_platform = (budget × split_platform) / cpl_platform
cpl_platform   = base_cpl(brand, model, objective)
                 × city_multiplier(city)
                 × competition_multiplier(brand, city)
                 × seasonality_multiplier(month)
```

Ranges rather than point estimates, because a false-precision number is what creates the CPL disputes that contributed to the previous agency shutdown. Low/high bounds widen as confidence falls.

### 4.3 Data basis, in descending order of preference

1. **Our own historical performance** — actual CPL achieved for this city/brand/model/objective. Highest confidence. Available as soon as campaigns run, and improves permanently thereafter.
2. **Google Keyword Planner API** — live search volume and top-of-page bid estimates. Requires Google Ads API access. Not yet available.
3. **Seeded benchmarks** — India auto-vertical priors by segment and city tier. Lowest confidence, and the honest starting point.

The engine reports **which basis it used** and its sample size. A projection built on three prior campaigns must not present like one built on three hundred.

### 4.4 Guardrail — the failure that killed the last business

The FY25 post-mortem is explicit: sales made CPL commitments marketing never approved, causing overruns and disputes. The engine must not recreate that mechanism in software and at speed.

Therefore:
- Projections are **ranges with confidence**, never single numbers.
- Every projection is **persisted with its inputs, outputs and basis** — an auditable record of what was promised and on what grounds.
- Low-confidence projections are **visually marked** and carry an explicit caveat.
- Projections carry an **expiry** (14 days); a stale projection cannot be silently converted into a commitment.
- The committed CPL recorded on a dealer at activation is a **separate, deliberate field** — it does not auto-populate from the projection. Committing is a decision a human makes, not a side effect of a calculation.

---

## 5. The optimisation engine

### 5.1 The constraint that shapes it
Meta caps **ad-set budget changes at 4/hour** and **ad spend changes at 10/day**. Google throttles on a token bucket with no published QPS. Pinterest's guidelines go further and prohibit applications that "automatically initiate actions without specifically considering each action."

So "AI optimises 24/7" cannot mean continuously adjusting budgets. It means **continuous observation with batched, high-conviction intervention**. This is also better practice: frequent twiddling fights the platforms' own ML and degrades results.

### 5.2 Loop
```
observe (continuous)  →  detect (rules + LLM reasoning)  →  propose
   →  gate (auto-apply | AM approval)  →  apply (rate-limit aware)  →  log  →  measure
```

- **Observe** — metrics sync every 30 minutes.
- **Detect** — deterministic rules catch the unambiguous cases (budget pacing, CPL breach, zero-delivery, creative fatigue). LLM reasoning handles the contextual judgment rules can't express, and always produces a written rationale.
- **Gate** — reversible, low-risk, in-policy actions auto-apply (e.g. pausing a zero-conversion ad set that has spent 3× target CPL). Anything touching budget, targeting, or creative requires account-manager approval.
- **Apply** — through a rate-limit-aware queue that respects each platform's documented ceilings and backs off on 429.
- **Log** — every action recorded with its rationale, in plain language. This log feeds the dealer-facing portal, where the separate PRD requires entries be team-attributed and free of system/automation references. The engine produces the substance; a human approves the wording.

### 5.3 Safety
- Hard spend ceilings per dealer, enforced locally before any API call.
- Every optimisation is reversible, with the prior state stored.
- A kill switch halts all automated action instantly, globally.
- Rate-limit budget is tracked per platform per account and never knowingly exceeded.

---

## 6. Build sequence

| Phase | Deliverable | Depends on API access? |
|---|---|---|
| 1 | Foundation — Next.js on Cloud Run, Firestore, Firebase Auth, dealer registry | No |
| 2 | **Projection engine** + benchmark seed | No |
| 3 | Activation workflow (sales → marketing) | No |
| 4 | Campaign console + provider abstraction (simulated live) | No |
| 5 | Metrics layer + per-dealer rollups | Simulated now, live later |
| 6 | Optimisation engine — rules, then LLM reasoning | Simulated now, live later |
| 7 | Live Google + Meta providers verified against real credentials | **Yes — blocked** |

Phases 1–6 deliver a genuinely useful internal tool with no platform API access at all. Phase 7 is gated on credentials that do not yet exist.

---

## 7. Open items requiring human decision

1. **Meta Page requirement** — Meta ads must run from a Facebook Page. If dealers have no Page and grant no access, either we run ads from a CarDekho Page (the ad shows *our* brand, not the dealer's) or we create a Page per dealer (which must be checked against Meta's authenticity and brand-representation policies). This is being verified; it is the one open question that could force a change to the zero-dealer-dependency goal.
2. **Ad account topology** — one shared ad account for all dealers, versus one client account per dealer under our MCC. Sharing is simpler; separation contains policy-strike blast radius and makes attribution and billing cleaner. Recommendation pending the policy verification.
3. **Google Ads API access** — no developer token yet. Basic access is now auto-reviewed in minutes; Standard requires a ~10-day audit. Should be started immediately as it gates Phase 7 and the live projection data source.
4. **Meta App Review** — requires demonstrating a real multi-client onboarding flow, so it cannot be completed before real dealer campaigns exist. Sequence deliberately.
