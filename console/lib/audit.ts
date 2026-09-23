/**
 * Google Ads account audit.
 *
 * Runs over a showroom's OWN historical campaign data, read through read-only
 * access, and reports where their money is currently going nowhere.
 *
 * This is the acquisition wedge, not a reporting feature. Asking a dealer to
 * hand over campaign management cold is a large ask from a standing start;
 * asking for read-only access so we can show them what they are wasting is a
 * small one, and it converts on evidence rather than on a pitch.
 *
 * Two rules shape everything here:
 *
 *  1. Every finding carries an estimated rupee figure, because "your account
 *     structure is suboptimal" does not sell and "you are losing about
 *     Rs 18,000 a month on search terms that never convert" does.
 *
 *  2. Every estimate carries a confidence, and the ranges are deliberately
 *     conservative. A waste figure we cannot stand behind in the next meeting
 *     is worse than no audit — it is the same failure mode as an over-promised
 *     CPL, just earlier in the relationship.
 */

import type {
  Audit, AuditCheck, AuditFinding, AuditSeverity, Confidence, Provenance,
} from "./types"

/** The shape we can read from a Google Ads account with read-only access. */
export interface AuditInput {
  dealerId: string
  googleCustomerId: string | null
  periodDays: number
  spend: number
  leads: number
  clicks: number
  impressions: number
  campaignCount: number
  adGroupCount: number
  negativeKeywordCount: number
  /** Share of spend on broad-match keywords, 0..1. */
  broadMatchSpendShare: number
  conversionTrackingConfigured: boolean
  locationTargetingConfigured: boolean
  /** Spend on search terms that produced no conversion at all. */
  zeroConversionSearchTermSpend: number
  /** Responsive search ads rated poor or average by Google. */
  weakAdCount: number
  totalAdCount: number
  monthlyBudget: number
  provenance: Provenance
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`
const pctText = (n: number) => `${Math.round(n * 100)}%`

/** Scale a period figure to a monthly one so every finding is comparable. */
function monthly(value: number, periodDays: number): number {
  if (periodDays <= 0) return 0
  return (value / periodDays) * 30
}

type Rule = (i: AuditInput) => AuditFinding | null

/**
 * No negative keywords.
 *
 * The single most common and most expensive gap in a dealer account. Without
 * negatives, car-model campaigns pay for "second hand", "price in pakistan",
 * "olx", "images", "mileage" and every other non-buyer query.
 */
const noNegativeKeywords: Rule = (i) => {
  if (i.negativeKeywordCount >= 20) return null
  const share = i.negativeKeywordCount === 0 ? 0.22 : 0.12
  const waste = monthly(i.spend, i.periodDays) * share
  return {
    check: "no_negative_keywords",
    severity: i.negativeKeywordCount === 0 ? "high" : "medium",
    title: "Little or no negative keyword protection",
    finding:
      i.negativeKeywordCount === 0
        ? "There are no negative keywords on this account. Searches like “second hand”, “price list”, “images” and “mileage” are being paid for alongside genuine buyer searches."
        : `Only ${i.negativeKeywordCount} negative keywords are in place, which is well short of what a model-led campaign needs.`,
    recommendation:
      "Add a negative keyword list covering used-car, research and non-buying intent, and review search terms weekly for the first month.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: i.negativeKeywordCount === 0 ? "high" : "medium",
  }
}

/**
 * Search terms that spent and never converted.
 *
 * This is the most defensible finding in the audit because it is measured
 * rather than inferred — we can name the exact spend.
 */
const irrelevantSearchTerms: Rule = (i) => {
  if (i.zeroConversionSearchTermSpend <= 0) return null
  const share = i.spend > 0 ? i.zeroConversionSearchTermSpend / i.spend : 0
  if (share < 0.08) return null
  const waste = monthly(i.zeroConversionSearchTermSpend, i.periodDays) * 0.7
  return {
    check: "irrelevant_search_terms",
    severity: share > 0.25 ? "high" : "medium",
    title: "Spend on searches that never produced a lead",
    finding: `${pctText(share)} of spend over the last ${i.periodDays} days went to search terms that produced no enquiry at all — ${inr(i.zeroConversionSearchTermSpend)} in the period.`,
    recommendation:
      "Exclude the terms with meaningful spend and no conversions, and tighten match types on the rest. Some of this spend is recoverable rather than simply cut.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: "high",
  }
}

/** Broad match without the negatives or bidding to control it. */
const broadMatchWaste: Rule = (i) => {
  if (i.broadMatchSpendShare < 0.4) return null
  if (i.negativeKeywordCount >= 50 && i.conversionTrackingConfigured) return null
  const waste = monthly(i.spend, i.periodDays) * i.broadMatchSpendShare * 0.25
  return {
    check: "broad_match_waste",
    severity: "medium",
    title: "Broad match running without guardrails",
    finding: `${pctText(i.broadMatchSpendShare)} of spend is on broad match keywords, without the negative keyword list or conversion data needed to keep it in check.`,
    recommendation:
      "Move the core model terms to phrase and exact match, and keep broad match only where conversion tracking can steer it.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: "medium",
  }
}

/**
 * No conversion tracking.
 *
 * Severe and often invisible to the dealer: Google's bidding cannot optimise
 * toward leads it never hears about, so the whole budget is spent blind.
 */
const noConversionTracking: Rule = (i) => {
  if (i.conversionTrackingConfigured) return null
  const waste = monthly(i.spend, i.periodDays) * 0.3
  return {
    check: "no_conversion_tracking",
    severity: "high",
    title: "Google cannot see which clicks became enquiries",
    finding:
      "No conversion tracking is configured. Google's bidding is optimising toward clicks rather than enquiries, because it has never been told which clicks turned into a lead.",
    recommendation:
      "Set up conversion tracking on the landing page and import call leads from the tracking number, then move the campaign to a lead-based bidding strategy.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: "high",
  }
}

/** Everything in one ad group means one message for every search. */
const singleAdGroup: Rule = (i) => {
  if (i.campaignCount === 0) return null
  const perCampaign = i.adGroupCount / i.campaignCount
  if (perCampaign > 1.5) return null
  const waste = monthly(i.spend, i.periodDays) * 0.08
  return {
    check: "single_ad_group",
    severity: "medium",
    title: "One ad group carrying every keyword",
    finding: `The account has ${i.adGroupCount} ad group${i.adGroupCount === 1 ? "" : "s"} across ${i.campaignCount} campaign${i.campaignCount === 1 ? "" : "s"}, so every search sees the same ad copy regardless of what was typed.`,
    recommendation:
      "Split by model and intent so a test-drive search and a price search each get an ad written for it.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: "medium",
  }
}

/** Under-delivery is its own waste — budget sitting idle buys nothing. */
const budgetUnderpacing: Rule = (i) => {
  if (i.monthlyBudget <= 0) return null
  const actual = monthly(i.spend, i.periodDays)
  const utilisation = actual / i.monthlyBudget
  if (utilisation > 0.8) return null
  const unspent = i.monthlyBudget - actual
  return {
    check: "budget_underpacing",
    severity: utilisation < 0.5 ? "high" : "low",
    title: "Budget is not being spent",
    finding: `Only ${pctText(utilisation)} of the ${inr(i.monthlyBudget)} monthly budget is being used. Roughly ${inr(unspent)} a month is going unspent, usually a sign of narrow targeting or bids set too low to enter the auction.`,
    recommendation:
      "Widen location and keyword coverage and raise bids to a competitive level. Unspent budget produces no leads at all.",
    // Not waste in the same sense — the money is not lost, the opportunity is.
    estimatedMonthlyWaste: 0,
    confidence: "high",
  }
}

const weakAdCopy: Rule = (i) => {
  if (i.totalAdCount === 0) return null
  const share = i.weakAdCount / i.totalAdCount
  if (share < 0.5) return null
  const waste = monthly(i.spend, i.periodDays) * 0.07
  return {
    check: "weak_ad_copy",
    severity: "low",
    title: "Ad copy rated poor or average",
    finding: `${i.weakAdCount} of ${i.totalAdCount} ads are rated below Good by Google, which suppresses how often they show and what they cost.`,
    recommendation:
      "Rewrite headlines around the model, the offer and the location, and add the assets Google is asking for.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: "low",
  }
}

const noLocationTargeting: Rule = (i) => {
  if (i.locationTargetingConfigured) return null
  const waste = monthly(i.spend, i.periodDays) * 0.18
  return {
    check: "no_location_targeting",
    severity: "high",
    title: "Ads are not limited to the catchment area",
    finding:
      "No location targeting is set, so the campaign is paying for clicks from people who will never visit this showroom.",
    recommendation:
      "Restrict to a realistic drive-time radius around the showroom, and exclude cities where there is another dealer for the same brand.",
    estimatedMonthlyWaste: Math.round(waste),
    confidence: "high",
  }
}

const RULES: Rule[] = [
  noConversionTracking,
  noLocationTargeting,
  noNegativeKeywords,
  irrelevantSearchTerms,
  broadMatchWaste,
  singleAdGroup,
  weakAdCopy,
  budgetUnderpacing,
]

const SEVERITY_ORDER: Record<AuditSeverity, number> = { high: 0, medium: 1, low: 2 }

export function runAudit(input: AuditInput, now = new Date()): Omit<Audit, "id"> {
  const findings = RULES.map((rule) => rule(input))
    .filter((f): f is AuditFinding => f !== null)
    .sort((a, b) => {
      const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      return bySeverity !== 0 ? bySeverity : b.estimatedMonthlyWaste - a.estimatedMonthlyWaste
    })

  const rawWaste = findings.reduce((s, f) => s + f.estimatedMonthlyWaste, 0)
  const monthlySpend = monthly(input.spend, input.periodDays)

  // Findings overlap — the same rupee can be caught by both the missing
  // negatives rule and the zero-conversion search term rule. Cap the total so
  // the headline figure stays defensible in front of the dealer.
  const totalEstimatedWaste = Math.round(Math.min(rawWaste, monthlySpend * 0.45))

  return {
    dealerId: input.dealerId,
    googleCustomerId: input.googleCustomerId,
    periodDays: input.periodDays,
    observedSpend: input.spend,
    observedLeads: input.leads,
    observedCpl: input.leads > 0 ? input.spend / input.leads : null,
    findings,
    totalEstimatedWaste,
    wastePercent: monthlySpend > 0 ? totalEstimatedWaste / monthlySpend : 0,
    provenance: input.provenance,
    status: "ready",
    createdAt: now.toISOString(),
    sharedAt: null,
    createdBy: "system",
  }
}

/** One line a salesperson can open with. */
export function auditHeadline(audit: Omit<Audit, "id">): string {
  if (audit.findings.length === 0) {
    return "This account is well structured. There is no obvious waste to recover — any gain will come from scale rather than clean-up."
  }
  if (audit.totalEstimatedWaste <= 0) {
    return `We found ${audit.findings.length} thing${audit.findings.length === 1 ? "" : "s"} holding this account back, though none of it is money being actively wasted.`
  }
  return (
    `About ${inr(audit.totalEstimatedWaste)} a month — roughly ${pctText(audit.wastePercent)} of spend — ` +
    `is going to clicks that do not become enquiries. We found ${audit.findings.length} fixable ` +
    `issue${audit.findings.length === 1 ? "" : "s"}, ${audit.findings.filter((f) => f.severity === "high").length} of them serious.`
  )
}
