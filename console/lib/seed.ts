/**
 * Seed data for the in-memory store.
 *
 * Everything written here carries provenance "simulated". It exists so the
 * console is demonstrable and testable before real ad-platform credentials
 * exist. It must never be presented as real performance.
 */

import type { Store } from "./store"
import type {
  Campaign, Dealer, Lead, LeadSource, LeadStatus, MetricsDaily, Optimization,
  Order, User,
} from "./types"
import { runAudit } from "./audit"

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
    googleBusinessProfileLinked: opts.google ?? false,
    googleBusinessAccountEmail: opts.google ? `gbp.${c}@example.in` : null,
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
    platform: {
      ...assets({
        google: true, meta: true, code: "srimrt",
        ownership: "dealer_linked", billing: "dealer_billed",
      }),
      meta: {
        ownership: "dealer_linked" as const,
        billing: "dealer_billed" as const,
        grant: "revoked" as const,
        lastVerifiedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
      },
    },
  },
  {
    code: "KLKIAP", name: "Kalyani Kia", city: "Pune", state: "Maharashtra",
    brands: ["Kia"], models: ["Seltos", "Sonet", "Carens"],
    monthlyBudget: 180_000, committedCpl: 520, virtualNumber: "+91 80random-0115",
    landingPageUrl: "https://lp.cardekho-ads.in/kalyani-kia-pune",
    lmsAccountRef: "LMS-KLKIAP-001", status: "active", ownerId: "u_am1",
    platform: {
      ...assets({
        google: true, meta: true, code: "klkiap",
        ownership: "dealer_linked", billing: "agency_billed",
      }),
      // Part-way through onboarding: they own and connected Google, created
      // the Meta portfolio and Page, but have not granted us partner access.
      metaAdAccountId: null,
      metaVerified: false,
      metaState: "in_progress" as const,
      meta: {
        ownership: "dealer_linked" as const,
        billing: "agency_billed" as const,
        grant: "invited" as const,
        lastVerifiedAt: null,
      },
    },
  },
  {
    code: "MGNTOY", name: "Magnum Toyota", city: "Indore", state: "Madhya Pradesh",
    brands: ["Toyota"], models: ["Innova Hycross", "Fortuner", "Glanza"],
    monthlyBudget: 75_000, committedCpl: null, virtualNumber: null,
    landingPageUrl: null, lmsAccountRef: null, status: "audit_ready", ownerId: "u_am2",
    platform: assets({ agreement: false, docs: false, code: "mgntoy" }),
  },
]

export async function seed(store: Store): Promise<void> {
  // Never shadow a real provisioned sign-in. Those carry the Firebase uid as
  // their id; seeding a second record with the same email would leave two
  // rows per person and make role lookup depend on iteration order.
  const existing = await store.listUsers()
  const taken = new Set(existing.map((u) => u.email.toLowerCase()))
  for (const u of USERS) {
    if (!taken.has(u.email.toLowerCase())) await store.createUser(u)
  }

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

  await seedLeads(store, dealers, campaigns)

  // The prospect showroom has a finished audit waiting to be shared.
  const prospect = dealers.find((d) => d.status === "audit_ready")
  if (prospect) await seedAudit(store, prospect.id)
}

/**
 * A completed audit for the prospect showroom.
 *
 * This is the acquisition motion: read-only access first, audit their existing
 * spend, show the waste, convert on the evidence. Deliberately a messy account,
 * because a tidy one would not illustrate the point.
 */
export async function seedAudit(store: {
  createAudit: (a: any) => Promise<any>
}, dealerId: string): Promise<void> {
  const audit = runAudit({
    dealerId,
    googleCustomerId: "482-990-1288",
    periodDays: 30,
    spend: 96_400,
    leads: 118,
    clicks: 3_140,
    impressions: 121_000,
    campaignCount: 2,
    adGroupCount: 2,
    negativeKeywordCount: 0,
    broadMatchSpendShare: 0.71,
    conversionTrackingConfigured: false,
    locationTargetingConfigured: true,
    zeroConversionSearchTermSpend: 27_800,
    weakAdCount: 5,
    totalAdCount: 6,
    monthlyBudget: 100_000,
    provenance: "simulated",
  })
  await store.createAudit(audit)
}


const FIRST = [
  "Rahul", "Priya", "Amit", "Sneha", "Vikram", "Anjali", "Karthik", "Divya",
  "Rohan", "Meera", "Arjun", "Pooja", "Sanjay", "Nisha", "Manish", "Kavya",
  "Imran", "Farhan", "Ritu", "Deepak", "Aishwarya", "Suresh", "Neha", "Gaurav",
]
const LAST = [
  "Sharma", "Verma", "Nair", "Reddy", "Patel", "Singh", "Iyer", "Gupta",
  "Joshi", "Menon", "Rao", "Khan", "Desai", "Chauhan", "Pillai", "Bose",
]

/**
 * Seed leads that deliberately DO NOT match the platform conversion counts.
 *
 * Real accounts never reconcile cleanly: the pixel misses some form fills, and
 * calls to the virtual number are invisible to Google and Meta entirely. A seed
 * where our lead count equals the platform's would make the reconciliation view
 * look pointless, when the gap is the entire reason it exists.
 *
 * So: roughly 88% of platform-reported form conversions get a matching record,
 * and a further slice arrives as calls the platforms never saw.
 */
async function seedLeads(
  store: { createLead: (l: Omit<Lead, "id">) => Promise<Lead>; listMetrics: (d?: string) => Promise<MetricsDaily[]> },
  dealers: Dealer[],
  campaigns: Campaign[],
): Promise<void> {
  const rand = rng(77_2026)
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]

  const statuses: { s: LeadStatus; weight: number }[] = [
    { s: "new", weight: 0.34 },
    { s: "contacted", weight: 0.31 },
    { s: "qualified", weight: 0.21 },
    { s: "lost", weight: 0.14 },
  ]
  const pickStatus = (ageDays: number): LeadStatus => {
    // Fresh leads skew to new; older ones have been worked.
    if (ageDays <= 1 && rand() < 0.75) return "new"
    let r = rand()
    for (const { s, weight } of statuses) {
      if (r < weight) return s
      r -= weight
    }
    return "contacted"
  }

  const NOTES = [
    "Asked for on-road price. Sending quote.",
    "Wants an EMI breakdown before visiting.",
    "Booked a test drive for Saturday.",
    "Interested in exchange for a 2019 hatchback.",
    "Number not reachable across three attempts.",
    "Comparing with a competitor model.",
    null, null, null,
  ]

  for (const dealer of dealers) {
    if (dealer.status !== "active") continue
    const metrics = await store.listMetrics(dealer.id)

    for (const m of metrics) {
      const campaign = campaigns.find(
        (c) => c.dealerId === dealer.id && c.platform === m.platform,
      )
      const ageDays = Math.max(
        0,
        Math.round((Date.now() - new Date(m.date).getTime()) / 86_400_000),
      )

      // How much of the platform's reported conversions we actually hold.
      //
      // Kalyani Kia's Meta pixel is misconfigured — it fires on the thank-you
      // page but the form post fails, so the platform counts conversions we
      // have no lead record for. That is the tracking gap the reconciliation
      // view exists to catch, and a seed where every row reconciles cleanly
      // would make the view look pointless.
      const brokenTracking = dealer.code === "KLKIAP" && m.platform === "meta"
      const captureRate = brokenTracking ? 0.52 : 0.88
      const captured = Math.round(m.leads * captureRate)
      // Calls that never touched a pixel at all.
      const calls = Math.round(m.leads * 0.22 * rand())

      for (let i = 0; i < captured + calls; i++) {
        const isCall = i >= captured
        const source: LeadSource = isCall
          ? "call"
          : rand() < 0.8
            ? "landing_page"
            : "platform_form"

        const name = `${pick(FIRST)} ${pick(LAST)}`
        const hour = 9 + Math.floor(rand() * 11)
        const minute = Math.floor(rand() * 60)

        await store.createLead({
          dealerId: dealer.id,
          campaignId: campaign?.id ?? null,
          platform: m.platform,
          source,
          platformLeadId: source === "platform_form" ? `sim_form_${m.date}_${i}` : null,
          lmsRef: null,
          name,
          // Deliberately not a dialable range.
          phone: `+91 80000 ${String(10000 + Math.floor(rand() * 89999)).slice(0, 5)}`,
          email: isCall ? null : `${name.split(" ")[0].toLowerCase()}${Math.floor(rand() * 900 + 100)}@example.in`,
          model: pick(dealer.models),
          city: dealer.city,
          status: pickStatus(ageDays),
          notes: pick(NOTES),
          receivedAt: `${m.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
          provenance: "simulated",
        })
      }
    }
  }
}
