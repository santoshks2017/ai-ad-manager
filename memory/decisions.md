# Decisions

## 2026-09-18
- **Internal agency console, not self-serve.** Dealers are records, not tenants. Kills
  per-dealer OAuth, token lifecycle and dealer auth; makes campaign→showroom
  attribution load-bearing instead.
- **Firestore over Postgres.** Free tier was an explicit constraint and Cloud Run +
  Postgres needs connection pooling. Trade-off accepted: metrics use precomputed
  rollups. Repository layer isolates the store if this needs revisiting.
- **Single Next.js app on Cloud Run**, replacing the Express backend, which was ~95%
  mocks.
- **Provenance on every record** (`live` | `simulated`), surfaced in the UI. Replaces
  the previous `SANDBOX_MODE` that returned fabricated IDs silently.
- **Projections are ranges with a stated basis and confidence, never point estimates**,
  and always expire. Committed CPL is a separate, deliberate field — it never
  auto-populates from a quote. This is the direct mitigation for the FY25 failure.
- **Optimisation batches and asks for approval.** Meta's 4-changes/hour ceiling makes
  continuous adjustment impossible, and constant edits reset platform learning anyway.
- **Campaigns are always created paused.** Spend cannot be unwound.
- **Partial failure is reported, not rolled back.** Deleting a correctly created
  campaign to tidy an API response is worse than an honest half-finished job.

## 2026-09-23
- **Direction B preferred: showroom owns the ad account, CarDekho operates and pays.**
  Decisive factor is credit risk — agency-owned puts gross ad spend on the balance
  sheet for every showroom; delegated caps exposure at the unpaid fee. Google supports
  "client owns, agency pays" via manager billing setup; Meta's equivalent is
  unconfirmed and needs a partner-manager answer.
- **Audit-led acquisition adopted** from the ServiceAgent prototype. Ask for read-only
  access, audit existing spend, convert on evidence. Smaller ask, and the historical
  data it exposes is what replaces category benchmarks in the quote engine.
- **Audit waste is capped at 45% of spend**, not summed, because findings overlap. An
  indefensible waste figure is the same failure as an over-promised CPL, earlier.
- **CarDekho NCBD identity adopted** from the deployed Showrooms Console. Brand teal
  stays out of charts — it fails the data-mark lightness band; marks use a separately
  validated palette.
