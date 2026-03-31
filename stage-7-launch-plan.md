# Stage 7: Launch Plan
## AI Ad Manager — From Build to Market

---

## 1. Pre-Launch Checklist

### Technical
- [ ] All 5 MVP features functional and tested end-to-end
- [ ] Google Ads API partner approval received
- [ ] Meta Marketing API business verification complete
- [ ] Google OAuth and Meta OAuth flows tested with real ad accounts
- [ ] Lead webhook tested — leads flowing from both platforms into inbox
- [ ] Budget alert emails and SMS tested end-to-end
- [ ] Weekly report generation tested — PDF generated and email delivered
- [ ] Mobile responsiveness verified on iPhone and Android
- [ ] Load tested — dashboard loads under 2 seconds
- [ ] Error states handled — expired tokens, API failures, empty states
- [ ] SSL certificate active on all domains
- [ ] Staging environment matches production exactly
- [ ] Rollback plan documented (Railway redeploy to previous version)

### Content
- [ ] Landing page live with: value prop, 3 key features, pricing, demo request CTA
- [ ] Demo video (3 minutes): shows dashboard → campaign launch → lead inbox
- [ ] Onboarding email sequence written (5 emails: Day 0, 1, 3, 7, 14)
- [ ] In-app tooltips and guided tour written for all 5 main screens
- [ ] Help documentation: "How to connect Google Ads", "How to launch your first campaign"
- [ ] WhatsApp number set up for support (dealers prefer WhatsApp)
- [ ] Pricing page: ₹8,999/month (single dealership), ₹14,999/month (up to 3 dealerships)

### Legal
- [ ] Privacy Policy published (covers Google/Meta data handling — required for API approval)
- [ ] Terms of Service published
- [ ] Data processing agreement template ready (some dealer groups will ask)
- [ ] GST registration in place for billing

---

## 2. Go-to-Market Strategy

**Target segment for launch:** Single-dealership Dealer Principals in Tier 1 cities (Mumbai, Pune, Bangalore, Delhi, Hyderabad) — brands: Maruti Suzuki, Hyundai, Tata Motors

**Key Message:**
> "Run your Google and Meta ads yourself — no agency needed. See every rupee, capture every lead."

**Positioning Statement:**
AI Ad Manager is the first ad management platform built specifically for Indian car dealers — giving Dealer Principals real-time control over campaigns, leads, and budgets that agencies never provided.

**Why this positioning works:**
- Dealers are frustrated with agencies (cost, lack of transparency)
- "No agency needed" is a savings message AND a control message
- India-specific framing builds trust with local dealers

---

## 3. Marketing and Communication Plan

### Channel Breakdown

| Channel | Content | Frequency | Owner |
|---------|---------|-----------|-------|
| LinkedIn | Founder posts: "what dealers lose to bad ads", case studies, product demos | 3x/week | Founder |
| WhatsApp Groups | Dealer Principal communities — share insights, not ads | 2x/week | Sales |
| YouTube | Demo videos, "How to" tutorials for Google + Meta ads | 1x/week | Product |
| Instagram | Short Reels — before/after CPL comparisons, dashboard walkthroughs | 3x/week | Marketing |
| Email | Onboarding sequences + weekly "Ad tip of the week" newsletter | 1x/week | Marketing |
| Google Search Ads | "Car dealer ad management India", "auto dealer Google ads platform" | Ongoing | Paid |

### Launch Week Content Calendar

| Day | Action |
|-----|--------|
| T-7 | "Something big is coming for Indian car dealers" teaser post on LinkedIn |
| T-5 | Behind the scenes: "Why we built this" founder story on LinkedIn |
| T-3 | Demo video published on YouTube + LinkedIn |
| T-1 | "We launch tomorrow" post — invite 50 dealers to join waitlist |
| Launch Day | Product Hunt launch + LinkedIn announcement + WhatsApp blast to dealer groups |
| T+1 | Share first user testimonial / onboarding story |
| T+3 | "Here's what dealers discovered in their first week" post |
| T+7 | First week metrics post (# dealers signed up, # campaigns launched, # leads captured) |

---

## 4. Channel Strategy

| Channel | Priority | Rationale |
|---------|----------|-----------|
| **Direct WhatsApp outreach to Dealer Principals** | 🔴 Critical | Dealers live on WhatsApp — highest conversion rate |
| **LinkedIn (founder-led content)** | 🔴 Critical | Dealer Principals and automotive community is active on LinkedIn India |
| **Product Hunt launch** | 🟡 High | Tech-savvy early adopters, good for press and backlinks |
| **Automotive dealer associations** | 🟡 High | FADA (Federation of Automobile Dealers Associations) — events + newsletters |
| **YouTube tutorials** | 🟡 High | "How to run Google ads for car dealers India" — SEO + trust |
| **Google Search Ads** | 🟠 Medium | Capture intent; expensive but targeted |
| **CarDekho / AutoExpo presence** | 🟠 Medium | Industry events — meet dealers in person |
| **Cold email to dealers** | 🟠 Medium | Scrape dealer directories, personalised outreach |

---

## 5. Launch Timeline and Milestones

| Milestone | Date |
|-----------|------|
| **T-30:** Apply for Google Ads API + Meta API approvals | Day 1 of development |
| **T-30:** Build landing page + waitlist form | Week 1 |
| **T-14:** Demo video shot and edited | Week 4 |
| **T-14:** Beta access to 5 friendly dealers (design partners) | Week 5 |
| **T-7:** Collect feedback from beta dealers, fix critical bugs | Week 5–6 |
| **T-7:** All pre-launch checklist items complete | Week 6 |
| **T-3:** Content scheduled across all channels | Week 6 |
| **Launch Day:** Product Hunt + LinkedIn + WhatsApp blast | Week 7 |
| **T+7:** First paid conversion target: 3 dealers | Week 8 |
| **T+30:** Target: 10 paying dealers, ₹90K MRR | Week 10 |
| **T+90:** Target: 30 paying dealers, ₹2.7L MRR | Week 16 |

---

## 6. Success Metrics and KPIs

### Launch Week Targets (Day 0–7)
| Metric | Target |
|--------|--------|
| Waitlist signups | 100+ |
| Product Hunt upvotes | 200+ |
| Demo requests | 25+ |
| Onboarded beta dealers | 5 |
| Paying conversions | 3 |

### 30-Day Targets
| Metric | Target |
|--------|--------|
| Paying dealers | 10 |
| MRR | ₹90,000 |
| Campaigns launched | 30+ |
| Leads captured via platform | 500+ |
| Churn | 0% |
| NPS | >40 |

### 90-Day Targets
| Metric | Target |
|--------|--------|
| Paying dealers | 30 |
| MRR | ₹2,70,000 |
| Average campaigns per dealer/month | 3+ |
| Google + Meta ad spend managed | ₹50L+ |

---

## 7. Risk Management and Rollback Plan

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Google/Meta API approval delayed | Medium | High — blocks campaign launch | Launch with dashboard + lead inbox only; offer manual campaign setup as interim |
| Low conversion rate from demo to paid | Medium | High | Offer 14-day free trial; do white-glove onboarding for first 10 dealers |
| Negative word-of-mouth from early bugs | Low | High | Fix within 24 hours; give affected dealer 1 month free |
| Dealer loses confidence due to API error | Medium | Medium | Show clear error messages; have WhatsApp support active 9AM–7PM |

**Rollback Plan:**
- Backend: Railway allows instant redeploy to previous build — do this if critical bug in production
- Feature flags: wrap new features in flags so they can be disabled without full redeploy
- Data: Supabase has point-in-time recovery — can restore DB to any point in last 7 days

---

## 8. Post-Launch Monitoring Plan

### Daily (First 30 Days)
- Check Sentry / error logs — any new errors
- Check new signups and activation rate
- Respond to all WhatsApp support messages within 2 hours
- Review any failed campaign publishes

### Weekly
- Review MRR, churn, new dealer activations
- Review NPS responses (send NPS survey on Day 7 and Day 30)
- Review top support questions — update help docs accordingly
- Check API usage limits (Google + Meta) — ensure not approaching quota

### Tools
| Purpose | Tool |
|---------|------|
| Error tracking | Sentry (free tier) |
| Uptime monitoring | UptimeRobot (free) |
| Analytics | PostHog (product analytics, free tier) |
| Support | WhatsApp Business + Freshdesk (free tier) |
| Revenue tracking | Razorpay dashboard |

---

## 9. Customer Support Readiness

| Channel | Hours | Response Time |
|---------|-------|--------------|
| WhatsApp Business | 9AM–7PM IST, Mon–Sat | Under 2 hours |
| Email (support@) | 24/7 monitored | Under 4 hours |
| In-app chat (Crisp) | 9AM–7PM IST | Under 30 minutes |

**Support priorities at launch:**
1. Account connection issues (Google/Meta OAuth)
2. Campaign not publishing
3. Leads not appearing
4. Report not received

**Pre-written responses for top 5 issues** should be ready in Freshdesk before launch day.

**Escalation:** All critical issues (data loss, billing errors) escalated to founder immediately via WhatsApp.

---

## 10. Feedback Collection Strategy

| Touchpoint | Method | Timing |
|-----------|--------|--------|
| Post-signup survey | Typeform (3 questions) | Day 1 |
| First campaign feedback | In-app prompt | After first campaign launched |
| NPS survey | Email via Delighted | Day 7 and Day 30 |
| Churn exit survey | Automated email on cancel | On cancellation |
| Monthly dealer calls | 30-min Zoom with 3 dealers/month | Monthly |
| WhatsApp feedback | Informal message to active dealers | Bi-weekly |

**What to do with feedback:**
- Tag all feedback in Notion by: Feature Area / Sentiment / Frequency
- Anything mentioned by 3+ dealers in a week → added to next sprint
- Anything blocking churn → fixed within 48 hours
- Share feedback summary with team every Monday

---

## Critical Path Summary

The three things that determine if this launch succeeds or fails:

1. **Google + Meta API approval** — apply on Day 1, follow up weekly
2. **5 design partner dealers onboarded before launch** — their testimonials and CPL improvements are the launch story
3. **Founder-led WhatsApp outreach** — the first 10 paying dealers will come from direct personal conversations, not ads
