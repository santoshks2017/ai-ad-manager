/**
 * Domain types for the agency operations console.
 *
 * One tenant: us. Dealers are records, not tenants — they have no logins and
 * no platform accounts. Campaigns run in our own Google MCC and Meta Business
 * Manager and are attributed back to a dealer by the local mapping here.
 */

export type Role = "sales" | "account_manager" | "admin"

export type Platform = "google" | "meta"

/**
 * Whether a record came from a real platform API or from the simulator.
 *
 * This is deliberately part of the persisted data rather than a runtime flag.
 * The previous codebase returned fabricated campaign IDs silently under a
 * SANDBOX_MODE env var, which made "is this real?" unanswerable downstream.
 * Carrying provenance on the record makes mixing detectable.
 */
export type Provenance = "live" | "simulated"

export type Objective =
  | "leads"
  | "test_drive"
  | "exchange"
  | "model_launch"
  | "festive_offer"

export const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: "leads", label: "General enquiry" },
  { value: "test_drive", label: "Test drive booking" },
  { value: "exchange", label: "Exchange / upgrade" },
  { value: "model_launch", label: "New model launch" },
  { value: "festive_offer", label: "Festive offer" },
]

export interface User {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
  createdAt: string
}

export interface Dealer {
  id: string
  /** Short stable code used in platform campaign names for attribution. */
  code: string
  name: string
  city: string
  state: string
  brands: string[]
  models: string[]
  monthlyBudget: number
  /** Set deliberately at activation. Never auto-populated from a projection. */
  committedCpl: number | null
  virtualNumber: string | null
  landingPageUrl: string | null
  lmsAccountRef: string | null
  status: ShowroomStatus
  ownerId: string | null
  /**
   * Platform assets provisioned BY US, on the dealer's behalf.
   *
   * Both platforms require one ad account per end-advertiser — Google's
   * third-party policy says "we require that you use a separate account for
   * each end-advertiser that you manage", and Meta's Business Tools Terms say
   * "each advertiser or client must be managed through separate ad accounts".
   * Sharing one account across dealers is a policy violation, not a shortcut.
   *
   * The dealer still never logs in. We create and operate all of this as their
   * authorised representative under a signed services agreement.
   */
  platform: PlatformAssets
  createdAt: string
  updatedAt: string
}

/**
 * Where a showroom sits in the acquisition and delivery pipeline.
 *
 * Carried over from the Dealer Campaign Portal prototype, which gets the motion
 * right: we do not ask a dealer to hand over campaign management cold. We ask
 * for READ-ONLY access first, audit what they are already spending, show them
 * the waste, and convert on that evidence.
 *
 * Two things make this worth adopting over a plain prospect/active flag:
 *  - The ask is small, so more dealers say yes.
 *  - The audit reads their real historical CPL, which is precisely the data the
 *    quote engine needs to stop relying on category benchmarks.
 */
export type ShowroomStatus =
  | "pending_connection"  // invited; has not linked their Google Ads yet
  | "pending_audit"       // read-only access granted, audit running
  | "audit_ready"         // findings available, not yet shared with the dealer
  | "audit_shared"        // dealer has seen the waste report, deciding
  | "active"              // campaigns live
  | "paused"
  | "churned"

export const SHOWROOM_STATUS_LABEL: Record<ShowroomStatus, string> = {
  pending_connection: "Awaiting account link",
  pending_audit: "Audit running",
  audit_ready: "Audit ready to share",
  audit_shared: "Awaiting decision",
  active: "Live",
  paused: "Paused",
  churned: "Churned",
}

export type ProvisionState = "not_started" | "in_progress" | "ready" | "blocked"

/**
 * Who owns the ad account, tracked per platform rather than per dealer — a
 * dealer can plausibly be agency-owned on Google and dealer-owned on Meta,
 * especially mid-transition.
 *
 *   agency_owned  — we create and own the account. The dealer touches nothing.
 *                   We carry the gross ad spend on our balance sheet.
 *   dealer_linked — the dealer owns the account; they granted us access
 *                   (Google manager link or OAuth, Meta Business Portfolio
 *                   partner access). They keep their history and audiences if
 *                   they leave, and our credit exposure is the unpaid fee
 *                   rather than the gross spend.
 */
export type OwnershipMode = "agency_owned" | "dealer_linked"

/**
 * Who pays the platform.
 *
 * These are deliberately separate from ownership, because the useful
 * combination is the one that is not obvious: on Google a dealer can own the
 * account while OUR payments profile is billed for it, via a manager billing
 * setup on consolidated invoicing. Google's docs are explicit that accounts
 * need to be LINKED to the paying manager, not created by it.
 *
 * The equivalent on Meta — whether a credit line can pay for an ad account we
 * only have partner access to — is NOT confirmed from any official Meta
 * source. Until it is, treat `agency_billed` on Meta as unverified.
 */
export type BillingMode = "agency_billed" | "dealer_billed"

/** Health of a delegated-access grant. Only meaningful when dealer_linked. */
export type GrantState =
  | "not_requested"
  | "invited"      // link sent, dealer has not completed it
  | "active"
  | "expired"      // Meta user tokens last ~60 days
  | "revoked"      // dealer withdrew access, or an employee left

export interface PlatformAccount {
  ownership: OwnershipMode
  billing: BillingMode
  /**
   * Only meaningful when ownership is dealer_linked. Delegated access breaks
   * silently — a password change, a revoked permission, or the employee who
   * granted it leaving. At a hundred dealers this needs monitoring, not trust.
   */
  grant: GrantState
  /** Last time a real API call against this account succeeded. */
  lastVerifiedAt: string | null
}

export interface PlatformAssets {
  /** Google Ads client account. Ours under our MCC, or the dealer's, linked. */
  googleCustomerId: string | null
  googleState: ProvisionState
  google: PlatformAccount
  /**
   * Google Advertiser Identity Verification, completed per dealer via the
   * "verifying on behalf of a client" flow. Without it the "Why this ad?"
   * disclosure can name us rather than the dealer.
   */
  googleVerified: boolean

  /** Meta needs three assets per dealer, not one. */
  metaBusinessId: string | null
  metaPageId: string | null
  metaAdAccountId: string | null
  metaState: ProvisionState
  metaVerified: boolean
  meta: PlatformAccount

  /**
   * The signed services agreement naming us as the dealer's authorised
   * representative. This is the actual authorisation layer for both
   * platforms — Meta's Pages Policy requires an "authorised representative"
   * and Google's India verification can ask for proof of the relationship.
   * Treat it as compliance infrastructure, not just a commercial contract.
   */
  servicesAgreementSigned: boolean
  /** Legal docs (GST / incorporation / Udyam) needed for both verifications. */
  legalDocsCollected: boolean
}

export type Confidence = "high" | "medium" | "low"

/** Which data source backed a projection. Reported to the user, never hidden. */
export type ProjectionBasis =
  | "historical"   // our own past campaigns for this segment
  | "keyword_api"  // live Google Keyword Planner data
  | "benchmark"    // seeded India auto-vertical priors

export interface ProjectionInput {
  budget: number
  city: string
  brand: string
  model: string
  objective: Objective
  durationDays: number
}

export interface PlatformProjection {
  platform: Platform
  spendShare: number
  spend: number
  cplLow: number
  cplHigh: number
  leadsLow: number
  leadsHigh: number
}

export interface ProjectionOutput {
  cplLow: number
  cplHigh: number
  leadsLow: number
  leadsHigh: number
  confidence: Confidence
  basis: ProjectionBasis
  sampleSize: number
  platforms: PlatformProjection[]
  /** Plain-language notes shown with the quote, e.g. competition warnings. */
  notes: string[]
  /** Projections go stale; a stale one must not become a silent commitment. */
  expiresAt: string
}

export interface Projection {
  id: string
  input: ProjectionInput
  output: ProjectionOutput
  createdBy: string
  createdAt: string
}

export type OrderStatus = "draft" | "submitted" | "activated" | "rejected"

export interface Order {
  id: string
  projectionId: string | null
  dealerId: string
  status: OrderStatus
  /** The CPL sales actually promised. A human decision, recorded explicitly. */
  committedCpl: number | null
  budget: number
  startDate: string
  notes: string | null
  submittedBy: string
  submittedAt: string
  activatedBy: string | null
  activatedAt: string | null
  rejectedReason: string | null
}

export interface Campaign {
  id: string
  dealerId: string
  platform: Platform
  platformCampaignId: string
  name: string
  objective: Objective
  dailyBudget: number
  status: "active" | "paused" | "ended" | "failed"
  provenance: Provenance
  createdBy: string
  createdAt: string
}

export interface MetricsDaily {
  id: string
  dealerId: string
  campaignId: string | null
  platform: Platform
  date: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  provenance: Provenance
}

export type OptimizationKind =
  | "pause_underperformer"
  | "shift_budget"
  | "adjust_bid"
  | "expand_targeting"
  | "refresh_creative"
  | "pacing_correction"

export type OptimizationStatus =
  | "proposed"
  | "approved"
  | "applied"
  | "rejected"
  | "reverted"

export interface Optimization {
  id: string
  campaignId: string
  dealerId: string
  kind: OptimizationKind
  /** Why, in plain language. Feeds the dealer-facing activity log. */
  rationale: string
  proposedChange: Record<string, unknown>
  /** Stored so every action is reversible. */
  priorState: Record<string, unknown> | null
  /** Low-risk reversible actions may auto-apply; everything else needs a human. */
  requiresApproval: boolean
  status: OptimizationStatus
  provenance: Provenance
  decidedBy: string | null
  createdAt: string
  decidedAt: string | null
  appliedAt: string | null
}

export interface Benchmark {
  id: string
  city: string
  segment: string
  objective: Objective
  platform: Platform
  cplLow: number
  cplHigh: number
  ctr: number
  convRate: number
  sampleSize: number
  source: string
  updatedAt: string
}


/* ------------------------------------------------------------------ Audit */

export type AuditSeverity = "high" | "medium" | "low"

export type AuditCheck =
  | "no_negative_keywords"
  | "broad_match_waste"
  | "no_conversion_tracking"
  | "single_ad_group"
  | "budget_underpacing"
  | "weak_ad_copy"
  | "irrelevant_search_terms"
  | "no_location_targeting"

export interface AuditFinding {
  check: AuditCheck
  severity: AuditSeverity
  title: string
  /** What we found, in the dealer's language — this goes in front of them. */
  finding: string
  recommendation: string
  /** Estimated monthly spend currently going nowhere, in rupees. */
  estimatedMonthlyWaste: number
  /** How sure we are. A guess presented as a finding is how trust is lost. */
  confidence: Confidence
}

export interface Audit {
  id: string
  dealerId: string
  /** The read-only Google Ads account we audited. */
  googleCustomerId: string | null
  periodDays: number
  observedSpend: number
  observedLeads: number
  observedCpl: number | null
  findings: AuditFinding[]
  totalEstimatedWaste: number
  /** Waste as a share of observed spend. The number sales leads with. */
  wastePercent: number
  provenance: Provenance
  status: "running" | "ready" | "shared"
  createdAt: string
  sharedAt: string | null
  createdBy: string
}


/* ------------------------------------------------------------------ Leads */

/**
 * Where a lead physically came in.
 *
 * Today the console holds leads directly. Once the LMS integration lands it
 * becomes the source of truth and these records sync from it — which is why
 * `lmsRef` exists now rather than being retrofitted later.
 */
export type LeadSource =
  | "landing_page"   // our hosted one-pager
  | "call"           // the showroom's assigned virtual number
  | "platform_form"  // Meta instant form / Google lead form

export type LeadStatus = "new" | "contacted" | "qualified" | "lost"

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "lost", label: "Lost" },
]

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  landing_page: "Landing page",
  call: "Phone call",
  platform_form: "Platform form",
}

export interface Lead {
  id: string
  dealerId: string
  campaignId: string | null
  platform: Platform
  source: LeadSource
  /** The platform's own id, where there is one. Used to dedupe on re-sync. */
  platformLeadId: string | null
  /** Set once the LMS integration lands; null until then. */
  lmsRef: string | null
  name: string
  phone: string
  email: string | null
  model: string | null
  city: string | null
  status: LeadStatus
  notes: string | null
  receivedAt: string
  provenance: Provenance
}


/**
 * A delegated access token for a showroom's platform account.
 *
 * Kept in its own collection rather than on the showroom record so ordinary
 * reads of a dealer never carry a live credential around the application.
 *
 * These belong in Secret Manager before real money runs through them —
 * Firestore is fine for the review flow, not for production spend.
 */
export interface PlatformToken {
  id: string
  dealerId: string
  platform: Platform
  accessToken: string
  /** Null when the token does not expire on a fixed schedule. */
  expiresAt: string | null
  scopes: string[]
  grantedAt: string
  lastVerifiedAt: string | null
}
