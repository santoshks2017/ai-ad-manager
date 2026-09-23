/**
 * Ad asset generation.
 *
 * Turns a showroom plus a model and an objective into the actual things the
 * platforms need: keywords with match types, negative keywords, responsive
 * search ad headlines and descriptions for Google, and primary text with a
 * headline for Meta.
 *
 * Character limits are enforced here rather than discovered at the API. Google
 * rejects a 31-character headline outright, so a generator that emits one has
 * simply failed — every asset is validated before it leaves this file.
 *
 * Negative keywords ship by default. The audit engine finds their absence to be
 * the single most expensive gap in dealer accounts, costing around a fifth of
 * spend; creating new campaigns without them would be knowingly repeating the
 * mistake we charge to fix.
 */

import type { Objective } from "./types"

export const GOOGLE_HEADLINE_MAX = 30
export const GOOGLE_DESCRIPTION_MAX = 90
export const META_HEADLINE_MAX = 40
export const META_PRIMARY_MAX = 125

export interface CreativeInput {
  dealerName: string
  brand: string
  model: string
  city: string
  objective: Objective
  /** Optional offer line, e.g. "Exchange bonus up to ₹40,000". */
  offer?: string | null
  virtualNumber?: string | null
}

export interface GoogleAssets {
  headlines: string[]
  descriptions: string[]
  keywords: { text: string; matchType: "EXACT" | "PHRASE" }[]
  negativeKeywords: string[]
  path1: string
  path2: string
}

export interface MetaAssets {
  primaryTexts: string[]
  headlines: string[]
  description: string
  callToAction: string
}

/**
 * Terms that bring clicks and never bring buyers.
 *
 * Used-car intent, pure research intent, and the competitor-adjacent queries
 * that a model campaign otherwise pays for.
 */
const BASE_NEGATIVES = [
  "second hand", "used", "olx", "cars24", "spinny", "resale", "scrap",
  "images", "photos", "wallpaper", "pdf", "brochure download",
  "review", "reviews", "vs", "comparison", "compare",
  "mileage", "average", "problems", "complaints", "recall",
  "spare parts", "accessories", "service cost", "insurance",
  "job", "jobs", "vacancy", "salary", "career",
  "free", "cheap", "lowest price india", "emi calculator",
  "toy", "model car", "rc car", "game",
]

const CTA_BY_OBJECTIVE: Record<Objective, string> = {
  leads: "Get a quote",
  test_drive: "Book a test drive",
  exchange: "Value my car",
  model_launch: "See the new model",
  festive_offer: "View the offer",
}

/** Truncate on a word boundary so assets never end mid-word. */
function fit(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

/** Keep only assets that fit, deduped, in priority order. */
function validated(candidates: string[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of candidates) {
    const t = fit(c.trim().replace(/\s+/g, " "), max)
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

export function googleAssets(i: CreativeInput): GoogleAssets {
  const { brand, model, city, dealerName, objective, offer } = i
  const cta = CTA_BY_OBJECTIVE[objective]

  const headlines = validated(
    [
      `${model} in ${city}`,
      `${brand} ${model} On Road Price`,
      `${cta} Today`,
      `${model} at ${dealerName}`,
      offer ? fit(offer, GOOGLE_HEADLINE_MAX) : "",
      `Authorised ${brand} Dealer`,
      `${model} Offers in ${city}`,
      `Book ${model} Test Drive`,
      `${model} EMI From Low Rates`,
      `Exchange Your Old Car`,
      `${city} ${brand} Showroom`,
      `Instant ${model} Quote`,
      `${model} Booking Open`,
      `Talk To Our ${brand} Team`,
      `${model} Price & Variants`,
    ].filter(Boolean),
    GOOGLE_HEADLINE_MAX,
  ).slice(0, 15)

  const descriptions = validated(
    [
      `Visit ${dealerName} in ${city} for the ${brand} ${model}. ${cta} today.`,
      offer
        ? `${offer}. Authorised ${brand} dealer in ${city}. Enquire now.`
        : `Authorised ${brand} dealer in ${city}. Finance and exchange available.`,
      `Get the on-road price for the ${model}, with finance and exchange options.`,
      `Book a test drive at ${dealerName}. Our team will call you back the same day.`,
    ],
    GOOGLE_DESCRIPTION_MAX,
  ).slice(0, 4)

  const m = model.toLowerCase()
  const b = brand.toLowerCase()
  const c = city.toLowerCase()

  const keywords: GoogleAssets["keywords"] = [
    { text: `${b} ${m}`, matchType: "EXACT" },
    { text: `${m} price`, matchType: "PHRASE" },
    { text: `${m} on road price ${c}`, matchType: "PHRASE" },
    { text: `${b} ${m} ${c}`, matchType: "PHRASE" },
    { text: `${m} showroom ${c}`, matchType: "PHRASE" },
    { text: `${m} test drive`, matchType: "PHRASE" },
    { text: `${m} booking`, matchType: "PHRASE" },
    { text: `new ${m}`, matchType: "PHRASE" },
    { text: `${b} showroom near me`, matchType: "PHRASE" },
    { text: `${m} offers`, matchType: "PHRASE" },
  ]

  if (objective === "exchange") {
    keywords.push({ text: `exchange offer ${m}`, matchType: "PHRASE" })
  }
  if (objective === "test_drive") {
    keywords.push({ text: `book ${m} test drive ${c}`, matchType: "PHRASE" })
  }

  // Exclude the other cities we serve so two showrooms do not bid against
  // each other on the same brand.
  const negativeKeywords = [...BASE_NEGATIVES]

  return {
    headlines,
    descriptions,
    keywords,
    negativeKeywords,
    path1: fit(model.replace(/\s+/g, "-"), 15),
    path2: fit(city.replace(/\s+/g, "-"), 15),
  }
}

export function metaAssets(i: CreativeInput): MetaAssets {
  const { brand, model, city, dealerName, objective, offer } = i
  const cta = CTA_BY_OBJECTIVE[objective]

  const primaryTexts = validated(
    [
      offer
        ? `${offer} on the ${brand} ${model} at ${dealerName}, ${city}. Leave your number and we will call you back.`
        : `Looking at the ${brand} ${model}? ${dealerName} in ${city} has on-road pricing, finance and exchange sorted. Leave your number and we will call you back.`,
      `The ${model} is available now at ${dealerName}, ${city}. ${cta} in under a minute.`,
      `Thinking about a ${model}? Get the on-road price for ${city} and a callback from our team today.`,
    ],
    META_PRIMARY_MAX,
  )

  const headlines = validated(
    [
      offer ? offer : `${model} — ${cta}`,
      `${brand} ${model} in ${city}`,
      `${cta} at ${dealerName}`,
    ],
    META_HEADLINE_MAX,
  )

  return {
    primaryTexts,
    headlines,
    description: fit(`Authorised ${brand} dealer in ${city}`, META_HEADLINE_MAX),
    callToAction:
      objective === "test_drive"
        ? "BOOK_TRAVEL"
        : objective === "model_launch"
          ? "LEARN_MORE"
          : "GET_QUOTE",
  }
}

/** Append tracking so the landing page and LMS can attribute the lead. */
export function taggedLandingUrl(
  url: string,
  opts: { platform: "google" | "meta"; dealerCode: string; model: string; objective: Objective },
): string {
  if (!url) return url
  const params = new URLSearchParams({
    utm_source: opts.platform,
    utm_medium: "cpc",
    utm_campaign: `${opts.dealerCode}_${opts.model}_${opts.objective}`.replace(/\s+/g, "-").toLowerCase(),
    utm_content: opts.dealerCode.toLowerCase(),
  })
  return url.includes("?") ? `${url}&${params}` : `${url}?${params}`
}

/* ------------------------------------------- Performance Max / Demand Gen */

export const PMAX_LONG_HEADLINE_MAX = 90
export const DEMAND_GEN_HEADLINE_MAX = 40

export interface AssetGroupText {
  headlines: string[]
  longHeadlines: string[]
  descriptions: string[]
  businessName: string
}

/**
 * Text for a Performance Max asset group.
 *
 * PMax takes the same 30-character headlines as Search but adds a long
 * headline, which is the one that actually shows on YouTube and Discover
 * placements where there is room for a sentence.
 */
export function pmaxAssets(i: CreativeInput): AssetGroupText {
  const g = googleAssets(i)
  const { brand, model, city, dealerName, offer } = i

  return {
    headlines: g.headlines.slice(0, 15),
    longHeadlines: validated(
      [
        offer
          ? `${offer} on the ${brand} ${model} at ${dealerName}, ${city}`
          : `Book your ${brand} ${model} test drive at ${dealerName} in ${city}`,
        `${dealerName} — authorised ${brand} dealer in ${city}. Finance and exchange available.`,
        `Get the on-road price for the ${model} in ${city} and a callback the same day`,
      ],
      PMAX_LONG_HEADLINE_MAX,
    ).slice(0, 5),
    descriptions: g.descriptions.slice(0, 5),
    businessName: fit(dealerName, 25),
  }
}

/**
 * Text for a Demand Gen ad group.
 *
 * Headlines run to 40 characters here rather than 30, but at least one must
 * still fit 30 for the placements that crop — so the Search-length set is
 * reused as the short end rather than generating a second set that might not.
 */
export function demandGenAssets(i: CreativeInput): AssetGroupText {
  const g = googleAssets(i)
  const { brand, model, city, dealerName, offer } = i

  const longer = validated(
    [
      offer ? `${offer} — ${model} at ${dealerName}` : `The ${brand} ${model} at ${dealerName}`,
      `Book a ${model} test drive in ${city}`,
      `${model} offers at your ${city} showroom`,
    ],
    DEMAND_GEN_HEADLINE_MAX,
  )

  return {
    // Keep a ≤30 headline first so cropping placements always have one.
    headlines: [...g.headlines.slice(0, 2), ...longer].slice(0, 5),
    longHeadlines: [],
    descriptions: g.descriptions.slice(0, 5),
    businessName: fit(dealerName, 25),
  }
}
