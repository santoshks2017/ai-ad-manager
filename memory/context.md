# Context

## What is being built
An **internal console** for CarDekho NCBD account managers to set up, run, optimise
and deliver Google + Meta ad campaigns for dealer showrooms. Not self-serve — dealers
do not log in to it.

Lives in `console/` (Next.js on Cloud Run + Firestore). The older `frontend/` and
`backend/` directories target the abandoned self-serve model and are obsolete.

## Why it exists
CarDekho's Google Ads agency business was shut down in FY25 for two reasons:
dealers had no visibility that work was happening (trust collapse), and sales
committed CPLs marketing never approved (overruns and disputes). Both failure modes
constrain the product design.

## Scope boundaries
- **In:** projection/quoting, showroom registry, campaign creation, optimisation,
  analytics, delegated-access onboarding, Google Ads audits.
- **Out:** landing pages, virtual numbers, and the LMS. Leads flow LP/VN → LMS
  directly, never through this console.
- Google and Meta only. LinkedIn is partner-gated and months away; not a launch platform.

## Hard platform constraints (verified against official policy, Sept 2026)
- Google requires "a separate account for each end-advertiser that you manage" —
  showrooms cannot share one ad account. Meta's Business Tools Terms mirror this.
- Every Meta ad runs from a Page that must represent the advertised business, so
  showroom ads cannot run from a CarDekho Page.
- **Meta ad account ownership never transfers between Business Portfolios.** Whoever
  creates it owns it permanently. Agency-owned Meta accounts are a one-way door.
- Meta caps ad-set budget changes at 4/hour and spend changes at 10/day. This is why
  optimisation batches rather than running continuously.
- Google's RMF exempts internal agency-use tools; that exemption ends if showrooms
  ever get logins.

## India tax (verified against Gazette text)
- The 6% equalisation levy on online advertising was withdrawn effective 1 Apr 2025
  (Finance Act 2025, s.146(b)). Most commentary online is stale on this.
- Google India Pvt Ltd and Meta India bill India-country accounts, so ordinary s.194C
  TDS applies, not s.195.
- **Open:** GST Rule 33 "pure agent". A percentage-of-spend fee pulls all media spend
  into CarDekho's own GST taxable turnover. Needs a CA before pricing hardens.

## People
- Santosh Sharma — Strategy & GTM, owner of this work.
