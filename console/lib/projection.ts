/**
 * Projection engine.
 *
 * Answers the question sales asks on the spot: "dealer has ₹X for <model> in
 * <city> — how many leads, at what CPL?" Today that takes a marketing manager
 * hours of manual research; this returns it in milliseconds.
 *
 * Design constraint that overrides everything else here: this engine must not
 * manufacture false precision. Sales committing to CPLs that marketing never
 * validated is a documented cause of the FY25 agency shutdown. So every result
 * is a RANGE with a stated confidence and a stated basis, never a single
 * number, and low-confidence results say so loudly.
 */

import {
  baseCpl, brandCompetition, cityTier, modelSegment,
  objectiveMultiplier, seasonality,
} from "./benchmarks"
import type {
  Confidence, PlatformProjection, Platform, ProjectionBasis,
  ProjectionInput, ProjectionOutput,
} from "./types"

/**
 * Below this monthly spend, splitting across two platforms starves both.
 * Meta ad sets need roughly 50 conversions/week to exit the learning phase;
 * Google needs comparable volume to optimise. Half of a small budget on each
 * platform often exits learning on neither, which is worse than concentrating.
 */
const MIN_SPLIT_BUDGET = 30_000

/** Default spend share for Meta by objective; Google takes the remainder. */
const META_SHARE: Record<ProjectionInput["objective"], number> = {
  leads: 0.65,          // Meta wins on volume for general enquiry
  test_drive: 0.45,     // higher intent — Google search pulls its weight
  exchange: 0.50,       // people actively search "exchange offer"
  model_launch: 0.70,   // reach and curiosity favour social
  festive_offer: 0.65,  // offer creative performs on feed
}

/** Half-width of the CPL band as a fraction, by confidence. */
const SPREAD: Record<Confidence, number> = {
  high: 0.15,
  medium: 0.25,
  low: 0.40,
}

export interface HistoricalSample {
  platform: Platform
  cpl: number
  leads: number
}

export interface ProjectionOptions {
  /** Our own past results for this segment, if any. Supersedes benchmarks. */
  historical?: HistoricalSample[]
  /** Defaults to now; injectable for deterministic tests. */
  now?: Date
}

function round(n: number): number {
  return Math.round(n)
}

function confidenceFor(basis: ProjectionBasis, sampleSize: number): Confidence {
  if (basis === "historical") {
    if (sampleSize >= 20) return "high"
    if (sampleSize >= 5) return "medium"
    return "low"
  }
  if (basis === "keyword_api") return "medium"
  return "low"
}

/**
 * Convert a spend and a CPL band into a lead-count band.
 *
 * Note the deliberate inversion: a HIGH CPL produces FEW leads. Getting this
 * backwards silently inflates every forecast, so it lives in one place and is
 * covered by tests.
 */
function leadsFromSpend(
  spend: number,
  cplLow: number,
  cplHigh: number,
): { leadsLow: number; leadsHigh: number } {
  return {
    leadsLow: Math.floor(spend / cplHigh),
    leadsHigh: Math.floor(spend / cplLow),
  }
}

function metaShare(input: ProjectionInput): number {
  if (input.budget < MIN_SPLIT_BUDGET) {
    // Concentrate rather than starve both platforms.
    return input.objective === "test_drive" || input.objective === "exchange"
      ? 0
      : 1
  }
  return META_SHARE[input.objective] ?? 0.6
}

function platformCpl(
  input: ProjectionInput,
  platform: Platform,
  now: Date,
): [number, number] {
  const segment = modelSegment(input.model)
  const [lo, hi] = baseCpl(segment, platform)

  const multiplier =
    { metro: 1.32, tier1: 1.0, tier2: 0.82, tier3: 0.7 }[cityTier(input.city)] *
    objectiveMultiplier(input.objective) *
    brandCompetition(input.brand) *
    seasonality(now.getMonth())

  return [lo * multiplier, hi * multiplier]
}

function buildNotes(
  input: ProjectionInput,
  basis: ProjectionBasis,
  confidence: Confidence,
  shares: { meta: number; google: number },
  now: Date,
): string[] {
  const notes: string[] = []

  if (basis === "benchmark") {
    notes.push(
      "Based on category benchmarks, not our own campaign history. Treat the range as indicative and re-check once we have run this segment.",
    )
  }
  if (confidence === "low") {
    notes.push(
      "Low confidence — quote the upper end of the CPL range to the dealer, not the lower.",
    )
  }
  if (input.budget < MIN_SPLIT_BUDGET) {
    const only = shares.meta === 1 ? "Meta" : "Google"
    notes.push(
      `Budget is below ₹${MIN_SPLIT_BUDGET.toLocaleString("en-IN")}/month, so this runs on ${only} alone. Splitting a budget this size across both platforms tends to leave neither with enough volume to optimise.`,
    )
  }
  const season = seasonality(now.getMonth())
  if (season >= 1.1) {
    notes.push(
      "Festive period — demand is high but so is competition, which pushes CPL up. Budget pacing matters more than usual.",
    )
  } else if (season <= 0.92) {
    notes.push("Off-peak month — CPL is typically softer than the annual average.")
  }
  if (cityTier(input.city) === "metro") {
    notes.push("Metro market — expect higher CPL and heavier competition than a tier-2 city.")
  }
  return notes
}

export function project(
  input: ProjectionInput,
  options: ProjectionOptions = {},
): ProjectionOutput {
  const now = options.now ?? new Date()
  const historical = options.historical ?? []

  const basis: ProjectionBasis = historical.length > 0 ? "historical" : "benchmark"
  const sampleSize = historical.length
  const confidence = confidenceFor(basis, sampleSize)
  const spread = SPREAD[confidence]

  const mShare = metaShare(input)
  const shares = { meta: mShare, google: 1 - mShare }

  const platforms: PlatformProjection[] = []

  for (const platform of ["meta", "google"] as Platform[]) {
    const share = shares[platform]
    if (share <= 0) continue

    const spend = input.budget * share

    let cplLow: number
    let cplHigh: number

    const samples = historical.filter((h) => h.platform === platform)
    if (samples.length > 0) {
      const mean = samples.reduce((s, h) => s + h.cpl, 0) / samples.length
      cplLow = mean * (1 - spread)
      cplHigh = mean * (1 + spread)
    } else {
      const [lo, hi] = platformCpl(input, platform, now)
      cplLow = lo
      cplHigh = hi
    }

    const { leadsLow, leadsHigh } = leadsFromSpend(spend, cplLow, cplHigh)

    platforms.push({
      platform,
      spendShare: share,
      spend: round(spend),
      cplLow: round(cplLow),
      cplHigh: round(cplHigh),
      leadsLow,
      leadsHigh,
    })
  }

  const leadsLow = platforms.reduce((s, p) => s + p.leadsLow, 0)
  const leadsHigh = platforms.reduce((s, p) => s + p.leadsHigh, 0)

  // Blended CPL is derived from the totals, not averaged from the platform
  // CPLs — averaging would ignore how the spend is actually distributed.
  const cplLow = leadsHigh > 0 ? round(input.budget / leadsHigh) : 0
  const cplHigh = leadsLow > 0 ? round(input.budget / leadsLow) : 0

  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()

  return {
    cplLow,
    cplHigh,
    leadsLow,
    leadsHigh,
    confidence,
    basis,
    sampleSize,
    platforms,
    notes: buildNotes(input, basis, confidence, shares, now),
    expiresAt,
  }
}
