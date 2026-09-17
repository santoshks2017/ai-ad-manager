/**
 * Seed data for the in-memory store.
 *
 * Everything written here carries provenance "simulated". It exists so the
 * console is demonstrable and testable before real ad-platform credentials
 * exist. It must never be presented as real performance.
 */

import type { Store } from "./store"
import type { Campaign, Dealer, MetricsDaily, Optimization, Order, User } from "./types"

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString()

const day = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

/** Deterministic pseudo-random so demo numbers are stable across restarts. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const USERS: User[] = [
  { id: "u_admin", email: "santosh.sharma@girnarsoft.com", name: "Santosh Sharma", role: "admin", active: true, createdAt: iso(120) },
  { id: "u_am1", email: "priya.nair@girnarsoft.com", name: "Priya Nair", role: "account_manager", active: true, createdAt: iso(90) },
  { id: "u_am2", email: "rahul.verma@girnarsoft.com", name: "Rahul Verma", role: "account_manager", active: true, createdAt: iso(75) },
  { id: "u_sales1", email: "aditya.rao@girnarsoft.com", name: "Aditya Rao", role: "sales", active: true, createdAt: iso(60) },
  { id: "u_sales2", email: "meera.joshi@girnarsoft.com", name: "Meera Joshi", role: "sales", active: true, createdAt: iso(45) },
]


/** Platform assets we provision per dealer. Dealers never log in to any of it. */
function assets(opts: {
  google?: boolean
  meta?: boolean
  verified?: boolean
  agreement?: boolean
  docs?: boolean
  code?: string
  /** Defaults to agency-owned; pass "dealer_linked" for a delegated dealer. */
  ownership?: "agency_owned" | "dealer_linked"
  billing?: "agency_billed" | "dealer_billed"
}): Dealer["platform"] {
  const c = opts.code ?? "XXX"
  const ownership = opts.ownership ?? "agency_owned"
  const billing = opts.billing ?? "agency_billed"
  const account = (ready: boolean) => ({
    ownership,
    billing,
    grant: (ownership === "dealer_linked"
      ? (ready ? "active" : "invited")
      : "not_requested") as Dealer["platform"]["google"]["grant"],
    lastVerifiedAt: ready ? new Date().toISOString() : null,
  })
  return {
    google: account(Boolean(opts.google)),
    meta: account(Boolean(opts.meta)),
    googleCustomerId: opts.google ? `${c}-google-client` : null,
    googleState: opts.google ? "ready" : "not_started",
    googleVerified: opts.google ? (opts.verified ?? true) : false,
    metaBusinessId: opts.meta ? `${c}-meta-business` : null,
    metaPageId: opts.meta ? `${c}-meta-page` : null,
    metaAdAccountId: opts.meta ? `${c}-meta-adacct` : null,
    metaState: opts.meta ? "ready" : "not_started",
    metaVerified: opts.meta ? (opts.verified ?? true) : false,
    servicesAgreementSigned: opts.agreement ?? true,
    legalDocsCollected: opts.docs ?? true,
  }
}

const DEALERS: Omit<Dealer, "id" | "createdAt" | "updatedAt">[] = [
  {
    code: "APXHYD", name: "Apex Hyundai", city: "Lucknow", state: "Uttar Pradesh",
    brands: ["Hyundai"], models: ["Creta", "Venue", "Exter"],
    monthlyBudget: 150_000, committedCpl: 420, virtualNumber: "+91 80random-0111",
    landingPageUrl: "https://lp.cardekho-ads.in/apex-hyundai-lucknow",
    lmsAccountRef: "LMS-APXHYD-001", status: "active", ownerId: "u_am1",
    platform: assets({ google: true, meta: true, code: "apxhyd" }),
  },
  {
    code: "SETMAH", name: "Sethi Mahindra Motors", city: "Noida", state: "Uttar Pradesh",
    brands: ["Mahindra"], models: ["Scorpio N", "XUV700", "Thar"],
    monthlyBudget: 220_000, committedCpl: 610, virtualNumber: "+91 80random-0112",
    landingPageUrl: "https://lp.cardekho-ads.in/sethi-mahindra-noida",
    lmsAccountRef: "LMS-SETMAH-001", status: "active", ownerId: "u_am1",
    platform: assets({ google: true, meta: true, code: "setmah" }),
  },
  {
    code: "RJTATA", name: "Rajdeep Tata Motors", city: "Jaipur", state: "Rajasthan",
    brands: ["Tata"], models: ["Nexon", "Punch", "Harrier"],
    monthlyBudget: 90_000, committedCpl: 340, virtualNumber: "+91 80random-0113",
    landingPageUrl: "https://lp.cardekho-ads.in/rajdeep-tata-jaipur",
    lmsAccountRef: "LMS-RJTATA-001", status: "active", ownerId: "u_am2",
    platform: assets({ google: true, meta: true, code: "rjtata" }),
  },
  {
    code: "SRIMRT", name: "Sri Maruti Arena", city: "Coimbatore", state: "Tamil Nadu",
    brands: ["Maruti Suzuki"], models: ["Swift", "Baleno", "Brezza"],
    monthlyBudget: 120_000, committedCpl: 295, virtualNumber: "+91 80random-0114",
    landingPageUrl: "https://lp.cardekho-ads.in/sri-maruti-coimbatore",
    lmsAccountRef: "LMS-SRIMRT-001", status: "active", ownerId: "u_am2",
    platform: assets({ google: true, meta: true, code: "srimrt" }),
  },
  {
    code: "KLKIAP", name: "Kalyani Kia", city: "Pune", state: "Maharashtra",
    brands: ["Kia"], models: ["Seltos", "Sonet", "Carens"],
    monthlyBudget: 180_000, committedCpl: 520, virtualNumber: "+91 80random-0115",
    landingPageUrl: "https://lp.cardekho-ads.in/kalyani-kia-pune",
    lmsAccountRef: "LMS-KLKIAP-001", status: "active", ownerId: "u_am1",
    platform: {
      ...assets({ google: true, meta: true, code: "klkiap" }),
      metaVerified: false,
      metaState: "in_progress" as const,
    },
  },
  {
    code: "MGNTOY", name: "Magnum Toyota", city: "Indore", state: "Madhya Pradesh",
    brands: ["Toyota"], models: ["Innova Hycross", "Fortuner", "Glanza"],
    monthlyBudget: 75_000, committedCpl: null, virtualNumber: null,
    landingPageUrl: null, lmsAccountRef: null, status: "prospect", ownerId: "u_am2",
    platform: assets({ agreement: false, docs: false, code: "mgntoy" }),
  },
]

export async function seed(store: Store): Promise<void> {
  for (const u of USERS) await store.createUser(u)

  const dealers: Dealer[] = []
  for (const d of DEALERS) dealers.push(await store.createDealer(d))

  const active = dealers.filter((d) => d.status === "active")

  // Campaigns — two per active dealer, one per platform.
  const campaigns: Campaign[] = []
  for (const d of active) {
    const model = d.models[0]
    const ym = new Date().toISOString().slice(0, 7).replace("-", "")
    for (const platform of ["google", "meta"] as const) {
      campaigns.push(
        await store.createCampaign({
          dealerId: d.id,
          platform,
          platformCampaignId: `sim_${platform}_${d.code}_${ym}`,
          name: `${d.code}__${d.brands[0]}__${model}__leads__${ym}`,
          objective: "leads",
          dailyBudget: Math.round((d.monthlyBudget / 30) * (platform === "meta" ? 0.65 : 0.35)),
          status: "active",
          provenance: "simulated",
          createdBy: d.ownerId ?? "u_am1",
        }),
      )
    }
  }

  // 30 days of daily metrics per campaign.
  //
  // Performance deliberately varies by dealer. A book where every dealer beats
  // its committed CPL is not a book anyone needs a console for — the tool earns
  // its place by surfacing the ones that are underwater, so the demo data has
  // to contain some.
  const PERFORMANCE: Record<string, number> = {
    APXHYD: 0.88,  // comfortably under target
    SETMAH: 1.24,  // over — the one that needs intervention
    RJTATA: 0.95,  // close to target
    SRIMRT: 0.79,  // best performer
    KLKIAP: 1.08,  // slightly over, worth watching
  }

  const rand = rng(20260918)
  for (const c of campaigns) {
    const dealer = dealers.find((d) => d.id === c.dealerId)!
    const targetCpl = dealer.committedCpl ?? 400
    const factor = PERFORMANCE[dealer.code] ?? 1.0
    // Split so the blended CPL lands near target × factor, then let the
    // per-platform gap (Meta cheaper, Google dearer) play out around it.
    const platformCpl =
      (c.platform === "meta" ? targetCpl * 0.78 : targetCpl * 1.7) * factor

    for (let i = 29; i >= 0; i--) {
      const variance = 0.75 + rand() * 0.6
      const spend = Math.round(c.dailyBudget * (0.85 + rand() * 0.3))
      const cpl = platformCpl * variance
      const leads = Math.max(0, Math.round(spend / cpl))
      const clicks = Math.round(leads * (c.platform === "meta" ? 9 : 5) * (0.8 + rand() * 0.4))
      const impressions = Math.round(clicks * (c.platform === "meta" ? 55 : 14) * (0.8 + rand() * 0.4))

      await store.upsertMetrics({
        id: `${c.dealerId}_${c.platform}_${day(i)}`,
        dealerId: c.dealerId,
        campaignId: c.id,
        platform: c.platform,
        date: day(i),
        spend, impressions, clicks, leads,
        provenance: "simulated",
      } satisfies MetricsDaily)
    }
  }

  // A few orders across the workflow.
  const orders: Omit<Order, "id">[] = [
    {
      projectionId: null, dealerId: dealers[5].id, status: "submitted",
      committedCpl: 480, budget: 75_000, startDate: day(-3),
      notes: "Dealer wants Innova Hycross focus. Festive push.",
      submittedBy: "u_sales1", submittedAt: iso(1),
      activatedBy: null, activatedAt: null, rejectedReason: null,
    },
    {
      projectionId: null, dealerId: dealers[0].id, status: "activated",
      committedCpl: 420, budget: 150_000, startDate: day(25),
      notes: "Creta + Venue. Lucknow 25km radius.",
      submittedBy: "u_sales1", submittedAt: iso(27),
      activatedBy: "u_am1", activatedAt: iso(26), rejectedReason: null,
    },
    {
      projectionId: null, dealerId: dealers[2].id, status: "activated",
      committedCpl: 340, budget: 90_000, startDate: day(20),
      notes: "Nexon EV emphasis.",
      submittedBy: "u_sales2", submittedAt: iso(22),
      activatedBy: "u_am2", activatedAt: iso(21), rejectedReason: null,
    },
  ]
  for (const o of orders) await store.createOrder(o)

  // Pending optimisation proposals for the approval queue.
  const proposals: Omit<Optimization, "id" | "createdAt">[] = [
    {
      campaignId: campaigns[1].id, dealerId: campaigns[1].dealerId,
      kind: "shift_budget",
      rationale:
        "Meta is delivering leads at ₹261 against ₹548 on Google for the same dealer over the last 7 days. Moving 15% of daily budget from Google to Meta should lift total lead volume at the same spend.",
      proposedChange: { from: "google", to: "meta", amountPerDay: 780 },
      priorState: { googleDaily: 1750, metaDaily: 3250 },
      requiresApproval: true, status: "proposed", provenance: "simulated",
      decidedBy: null, decidedAt: null, appliedAt: null,
    },
    {
      campaignId: campaigns[4].id, dealerId: campaigns[4].dealerId,
      kind: "pause_underperformer",
      rationale:
        "This ad set has spent ₹4,120 across 6 days with zero leads — over 3× the dealer's target CPL with nothing to show. Pausing stops the bleed; the budget returns to the ad set that is converting.",
      proposedChange: { action: "pause", adSetRef: "sim_adset_kia_retarget" },
      priorState: { status: "active", dailyBudget: 690 },
      requiresApproval: false, status: "proposed", provenance: "simulated",
      decidedBy: null, decidedAt: null, appliedAt: null,
    },
    {
      campaignId: campaigns[6].id, dealerId: campaigns[6].dealerId,
      kind: "pacing_correction",
      rationale:
        "Spend is pacing to ₹142,000 against a ₹120,000 monthly cap — roughly 18% over with 9 days left. Trimming the daily cap keeps the month inside budget without pausing delivery.",
      proposedChange: { dailyBudgetFrom: 4000, dailyBudgetTo: 3280 },
      priorState: { dailyBudget: 4000 },
      requiresApproval: true, status: "proposed", provenance: "simulated",
      decidedBy: null, decidedAt: null, appliedAt: null,
    },
  ]
  for (const p of proposals) await store.createOptimization(p)
}
