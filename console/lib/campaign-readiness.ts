/**
 * Whether a campaign can actually serve.
 *
 * Performance Max and Demand Gen will happily accept a campaign with no
 * imagery and then never deliver, or deliver badly with auto-generated filler.
 * "Created successfully" followed by silence is the worst failure mode there
 * is, so this checks before the API call rather than discovering it a week
 * later in the performance report.
 */

import { CAMPAIGN_TYPES, type CampaignType, type Dealer, type ImageAsset } from "./types"

export interface ReadinessProblem {
  kind: "missing_image" | "missing_logo" | "missing_landing_page" | "no_business_profile"
  /** Written for an account manager, naming what to go and get. */
  message: string
  blocking: boolean
}

export interface Readiness {
  ready: boolean
  problems: ReadinessProblem[]
}

export function campaignReadiness(
  type: CampaignType,
  dealer: Dealer,
  images: ImageAsset[],
): Readiness {
  const spec = CAMPAIGN_TYPES[type]
  const problems: ReadinessProblem[] = []

  const count = (role: ImageAsset["role"]) =>
    images.filter((i) => i.dealerId === dealer.id && i.role === role).length

  if (spec.requirements.landscapeImages > count("landscape")) {
    problems.push({
      kind: "missing_image",
      message: `${spec.label} needs a landscape image (1.91:1, at least 600×314). Ask the showroom for a wide photo of the forecourt or the model.`,
      blocking: true,
    })
  }
  if (spec.requirements.squareImages > count("square")) {
    problems.push({
      kind: "missing_image",
      message: `${spec.label} needs a square image (1:1, at least 300×300).`,
      blocking: true,
    })
  }
  if (spec.requirements.squareLogos > count("logo")) {
    problems.push({
      kind: "missing_logo",
      message: `${spec.label} needs a square logo (1:1, at least 128×128). The dealership's own logo, not the manufacturer's.`,
      blocking: true,
    })
  }

  // Demand Gen has no dependable lead form, so the landing page is the only
  // way a click becomes an enquiry.
  if (!spec.supportsLeadForm && !dealer.landingPageUrl) {
    problems.push({
      kind: "missing_landing_page",
      message: `${spec.label} cannot use a Google lead form, so it needs a landing page. This showroom has none recorded.`,
      blocking: true,
    })
  }

  if (type === "performance_max" && !dealer.platform?.googleBusinessProfileLinked) {
    problems.push({
      kind: "no_business_profile",
      message:
        "No Business Profile linked, so ads cannot show the address, directions or a call button, and store visits will not be measured. Not blocking, but it costs performance on a local business.",
      blocking: false,
    })
  }

  return { ready: problems.every((p) => !p.blocking), problems }
}
