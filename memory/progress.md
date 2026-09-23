# Progress

_Updated 2026-09-23._

## Live
`https://ad-manager-console-604219434671.asia-south1.run.app` — basic auth, user
`console`. Cloud Run + Firestore on GCP project `aiad-manager`, region asia-south1,
scale-to-zero. Code in `console/`, 6 tagged releases, 132 tests.

Screens: Showrooms (CPL vs committed), Quote, Activations, Onboarding, Audits,
Campaigns (+ create), Analytics (5 reports), Optimisations, Setup.

## Everything is simulated
No Google Ads developer token and no Meta app credentials exist. The live providers
are written against the documented APIs but have **never run against a real endpoint**.
Every figure in the console is generated.

## Known gaps
- **Fake audit trail.** Four API routes hardcode the actor (`u_am1` / `u_sales1`).
  For a product whose point is accountability, this is the biggest gap. Needs Firebase
  Auth restricted to the company domain.
- **Campaign creation makes an empty shell.** Radius, landing URL, headline and virtual
  number are collected by the form and sent to neither platform. No ad groups, keywords,
  ads, ad sets or creatives.
- **No metrics sync job** — nothing calls `fetchMetrics` on a schedule.
- **No apply queue** — approved optimisations are recorded but never applied.
- **Benchmark CPLs are estimates, not measured.** Calibrate against the FY24/FY25
  agency data before sales quotes from the tool.
- **Lead counting is unresolved.** CPL needs a lead count; leads live in the LMS. One
  virtual number per showroom also means Google and Meta calls cannot be told apart,
  which makes the platform-comparison optimiser unreliable.

## Next steps
1. File for platform access now — Meta Business Verification and App Review take weeks,
   and App Review wants to see a real multi-client flow.
2. Answer: does the LMS have an API?
3. Pull FY24/FY25 historical CPL data to calibrate benchmarks.
4. Decide the direction for the pilot cohort; pick 3–5 showrooms.
5. CA conversation on Rule 33 pure-agent invoicing.
6. Ask the Meta partner manager whether a credit line can pay for partner-access accounts.
7. Engineering order: real auth → real campaign creation → verify Google provider
   against a test account (unblocked today) → metrics sync → apply queue → scheduler.

## Deliberately not done
- **Cloud Scheduler** for the optimisation scan. It costs money and does nothing over
  sample data. Switch on when live metrics flow.
- **Budget alert** on the billing account — 2 minutes in the console, still outstanding.
