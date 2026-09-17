/**
 * Seeded benchmark priors for the Indian automotive lead-gen vertical.
 *
 * IMPORTANT — these are PRIORS, not measured results. They exist so the
 * projection engine can answer a sales question on day one, before we have run
 * a single campaign. Every projection built on them is reported with
 * basis="benchmark" and low/medium confidence, and the ranges are deliberately
 * wide. As real campaigns accumulate, `historical` basis supersedes this file
 * segment by segment and the ranges tighten.
 *
 * Do not narrow these ranges to look more precise. False precision on CPL is
 * the specific failure that contributed to the FY25 agency shutdown.
 */

import type { Objective, Platform } from "./types"

export type CityTier = "metro" | "tier1" | "tier2" | "tier3"

export type Segment =
  | "entry_hatch"
  | "hatch"
  | "sedan"
  | "compact_suv"
  | "midsize_suv"
  | "premium_suv"
  | "luxury"
  | "commercial"

/** Cities we see most often. Anything unlisted falls back to tier2. */
const CITY_TIERS: Record<string, CityTier> = {
  mumbai: "metro", delhi: "metro", "new delhi": "metro", gurgaon: "metro",
  gurugram: "metro", noida: "metro", ghaziabad: "metro", faridabad: "metro",
  bangalore: "metro", bengaluru: "metro", hyderabad: "metro", chennai: "metro",
  kolkata: "metro", pune: "metro", ahmedabad: "metro",

  jaipur: "tier1", lucknow: "tier1", chandigarh: "tier1", kochi: "tier1",
  indore: "tier1", nagpur: "tier1", coimbatore: "tier1", surat: "tier1",
  vadodara: "tier1", bhopal: "tier1", visakhapatnam: "tier1", patna: "tier1",
  ludhiana: "tier1", agra: "tier1", nashik: "tier1", rajkot: "tier1",
  varanasi: "tier1", amritsar: "tier1", ranchi: "tier1", guwahati: "tier1",

  kanpur: "tier2", meerut: "tier2", allahabad: "tier2", prayagraj: "tier2",
  jodhpur: "tier2", madurai: "tier2", raipur: "tier2", jabalpur: "tier2",
  gwalior: "tier2", vijayawada: "tier2", mysore: "tier2", mysuru: "tier2",
  jalandhar: "tier2", dehradun: "tier2", udaipur: "tier2", bareilly: "tier2",
  aligarh: "tier2", moradabad: "tier2", gorakhpur: "tier2", siliguri: "tier2",
}

/** Model → segment. Covers the high-volume Indian market; extend as needed. */
const MODEL_SEGMENTS: Record<string, Segment> = {
  // Entry hatch
  alto: "entry_hatch", "alto k10": "entry_hatch", spresso: "entry_hatch",
  "s-presso": "entry_hatch", eon: "entry_hatch", redigo: "entry_hatch",
  "kwid": "entry_hatch", "celerio": "entry_hatch",
  // Hatch
  swift: "hatch", baleno: "hatch", i20: "hatch", "grand i10": "hatch",
  "i10": "hatch", altroz: "hatch", tiago: "hatch", glanza: "hatch",
  "wagon r": "hatch", wagonr: "hatch", polo: "hatch", figo: "hatch",
  // Sedan
  dzire: "sedan", amaze: "sedan", aura: "sedan", tigor: "sedan",
  city: "sedan", verna: "sedan", ciaz: "sedan", slavia: "sedan",
  virtus: "sedan", "honda city": "sedan",
  // Compact SUV
  nexon: "compact_suv", venue: "compact_suv", sonet: "compact_suv",
  brezza: "compact_suv", "vitara brezza": "compact_suv", punch: "compact_suv",
  magnite: "compact_suv", kiger: "compact_suv", "exter": "compact_suv",
  "fronx": "compact_suv", "taisor": "compact_suv",
  // Midsize SUV
  creta: "midsize_suv", seltos: "midsize_suv", grandvitara: "midsize_suv",
  "grand vitara": "midsize_suv", hyryder: "midsize_suv", astor: "midsize_suv",
  kushaq: "midsize_suv", taigun: "midsize_suv", "curvv": "midsize_suv",
  "elevate": "midsize_suv", "syros": "midsize_suv",
  // Premium SUV
  scorpio: "premium_suv", "scorpio n": "premium_suv", thar: "premium_suv",
  xuv700: "premium_suv", harrier: "premium_suv", safari: "premium_suv",
  alcazar: "premium_suv", carens: "premium_suv", hector: "premium_suv",
  "innova": "premium_suv", "innova crysta": "premium_suv",
  "innova hycross": "premium_suv", fortuner: "premium_suv",
  "tucson": "premium_suv", "compass": "premium_suv", "xuv3xo": "compact_suv",
  // Luxury
  "3 series": "luxury", "5 series": "luxury", "c-class": "luxury",
  "e-class": "luxury", a4: "luxury", a6: "luxury", q3: "luxury",
  q5: "luxury", x1: "luxury", x3: "luxury", gla: "luxury", glc: "luxury",
}

/**
 * Base CPL in ₹ by segment and platform, for the baseline objective ("leads")
 * in a tier1 city at neutral seasonality.
 *
 * Meta runs cheaper and higher-volume but lower-intent; Google Search runs
 * dearer with markedly higher intent. That gap is real and is why the engine
 * recommends a split rather than a single platform.
 */
const BASE_CPL: Record<Segment, Record<Platform, [number, number]>> = {
  entry_hatch:  { meta: [70, 140],   google: [190, 340] },
  hatch:        { meta: [85, 165],   google: [220, 400] },
  sedan:        { meta: [110, 215],  google: [280, 520] },
  compact_suv:  { meta: [105, 205],  google: [260, 490] },
  midsize_suv:  { meta: [130, 260],  google: [320, 600] },
  premium_suv:  { meta: [180, 360],  google: [430, 820] },
  luxury:       { meta: [380, 900],  google: [880, 1900] },
  commercial:   { meta: [150, 320],  google: [360, 700] },
}

const CITY_MULTIPLIER: Record<CityTier, number> = {
  metro: 1.32, tier1: 1.0, tier2: 0.82, tier3: 0.70,
}

/**
 * Objective multiplier. A test-drive booking is a harder ask than an enquiry,
 * so it costs more per lead but the lead is worth more.
 */
const OBJECTIVE_MULTIPLIER: Record<Objective, number> = {
  leads: 1.0,
  test_drive: 1.45,
  exchange: 1.15,
  model_launch: 0.88,   // launch curiosity lifts CTR, lowering CPL
  festive_offer: 0.92,  // offer-led creative converts better
}

/**
 * High dealer-density mass brands compete hardest against each other in
 * metros, which bids up cost. Luxury has thin volume but little bid pressure
 * per impression.
 */
const BRAND_COMPETITION: Record<string, number> = {
  maruti: 1.14, "maruti suzuki": 1.14, hyundai: 1.12, tata: 1.08,
  mahindra: 1.06, kia: 1.05, toyota: 1.03, honda: 1.03,
  mg: 0.98, skoda: 0.96, volkswagen: 0.96, renault: 0.94, nissan: 0.94,
  citroen: 0.92, jeep: 0.95,
  bmw: 1.0, "mercedes-benz": 1.0, mercedes: 1.0, audi: 1.0, volvo: 0.98,
}

/** Month index 0-11 → demand/competition multiplier. */
const SEASONALITY = [
  0.95, // Jan — post-year-end lull
  0.97, // Feb
  1.05, // Mar — fiscal year end push
  0.98, // Apr
  0.96, // May
  0.93, // Jun
  0.90, // Jul — monsoon trough
  0.92, // Aug
  1.12, // Sep — festive ramp
  1.20, // Oct — Navratri/Dussehra peak
  1.15, // Nov — Diwali tail
  1.02, // Dec — year-end clearance
]

export function cityTier(city: string): CityTier {
  return CITY_TIERS[city.trim().toLowerCase()] ?? "tier2"
}

export function modelSegment(model: string): Segment {
  const key = model.trim().toLowerCase()
  if (MODEL_SEGMENTS[key]) return MODEL_SEGMENTS[key]
  // Partial match — "creta facelift", "new nexon ev" etc.
  for (const [name, seg] of Object.entries(MODEL_SEGMENTS)) {
    if (key.includes(name)) return seg
  }
  return "compact_suv" // most common Indian segment; a safe central prior
}

export function brandCompetition(brand: string): number {
  return BRAND_COMPETITION[brand.trim().toLowerCase()] ?? 1.0
}

export function seasonality(month: number): number {
  return SEASONALITY[month] ?? 1.0
}

export function baseCpl(segment: Segment, platform: Platform): [number, number] {
  return BASE_CPL[segment][platform]
}

export function objectiveMultiplier(objective: Objective): number {
  return OBJECTIVE_MULTIPLIER[objective] ?? 1.0
}

export const KNOWN_MODELS = Object.keys(MODEL_SEGMENTS).sort()
export const KNOWN_CITIES = Object.keys(CITY_TIERS).sort()
export const KNOWN_BRANDS = Object.keys(BRAND_COMPETITION).sort()
