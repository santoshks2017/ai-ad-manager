# Memory Log

_Running session log — append-only, most recent at bottom._

## 2026-09-18 — build session
Reframed from self-serve SaaS to internal agency console. Built projection engine,
showroom book with CPL reconciliation, activation queue, optimisation rules engine,
analytics (5 reports), campaign creation, provider layer, delegated onboarding.
Deployed to Cloud Run + Firestore.

Research completed: ad platform APIs (9 platforms), competitor landscape, agency
account-model policy, India tax. Key finds — Icon (Thiel-backed, same pitch) shut down
March 2026; Meta caps budget changes at 4/hour; Meta ownership never transfers;
6% equalisation levy withdrawn Apr 2025.

Bugs found and fixed: quote engine matched historical CPL on city+model but ignored
objective (~35% under-quote on test drives); Firestore adapter read whole collections
(would have exceeded the free tier); mobile horizontal overflow; non-deterministic
in-memory IDs; schemaless-store migration crash on /onboarding.

## 2026-09-23 — audit + identity session
Reviewed two of Santosh's earlier builds: the deployed Showrooms Console
(`ads-ai-lyart.vercel.app`, = this repo's `frontend/`) and the ServiceAgent repo
(= `Agency Service Agent/`, the Dealer Campaign Portal prototype).

Adopted from them: audit-led acquisition motion (read-only access → audit → show waste
→ convert), the showroom lifecycle states, and the CarDekho NCBD visual identity.

Built the Google Ads audit engine — 8 checks, rupee figure per finding, capped headline.
Still to port: Leads/reconciliation view, Budget Manager controls, Reports artifact,
AM chat and tickets.
