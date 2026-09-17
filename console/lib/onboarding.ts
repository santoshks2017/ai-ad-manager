/**
 * Delegated-access onboarding.
 *
 * Builds the per-dealer link we send over WhatsApp. The dealer opens it, is
 * walked through whatever they are missing, and grants us access to their own
 * accounts.
 *
 * The design is shaped by three verified platform constraints:
 *
 *  1. Nothing can be delegated until the account exists. There is no OAuth
 *     consent for an account that has not been created, so the flow needs a
 *     "create it first" branch rather than a single consent button.
 *
 *  2. On Meta we cannot build the assets ourselves and hand them over later.
 *     Meta documents exactly three ways to get an ad account into a portfolio —
 *     create, claim, or share — and none of them is "transfer". Ownership
 *     follows whoever created it, permanently. So for the dealer to own it,
 *     the dealer's portfolio has to perform the create, even if we are on the
 *     call talking them through it.
 *
 *  3. Access decays silently. Meta will not tell us a token has been
 *     invalidated; it simply starts failing. So each grant carries its own
 *     health state and last-verified timestamp, and is re-checked rather than
 *     trusted.
 */

import type { Dealer, GrantState, Platform, PlatformAccount } from "./types"

/**
 * Default account config for records written before ownership and billing
 * existed on the model.
 *
 * Firestore has no schema, so older dealer documents simply lack these fields
 * and reading them throws. Rather than a migration script that has to be run
 * exactly once and in the right order, reads tolerate the older shape and
 * treat it as what it actually was: agency-owned and agency-billed.
 */
const LEGACY_ACCOUNT: PlatformAccount = {
  ownership: "agency_owned",
  billing: "agency_billed",
  grant: "not_requested",
  lastVerifiedAt: null,
}

export function platformAccount(dealer: Dealer, platform: Platform): PlatformAccount {
  return dealer.platform?.[platform] ?? LEGACY_ACCOUNT
}

const account = platformAccount

export type StepKind =
  | "create_google_account"
  | "link_google_manager"
  | "create_meta_portfolio"
  | "create_meta_page"
  | "create_meta_adaccount"
  | "grant_meta_partner_access"
  | "share_payment_method"

export interface OnboardingStep {
  kind: StepKind
  platform: Platform
  title: string
  /** What the dealer actually has to do, in their words not ours. */
  dealerAction: string
  /** Why it cannot be done for them. Shown to the account manager, not the dealer. */
  whyDealerMustDoIt: string | null
  done: boolean
}

/**
 * Work out what a dealer still has to do, in order.
 *
 * Only returns steps for platforms set to dealer_linked — an agency-owned
 * platform needs nothing from the dealer by definition.
 */
export function onboardingSteps(dealer: Dealer): OnboardingStep[] {
  const steps: OnboardingStep[] = []
  const p = dealer.platform
  const google = account(dealer, "google")
  const meta = account(dealer, "meta")

  if (google.ownership === "dealer_linked") {
    steps.push({
      kind: "create_google_account",
      platform: "google",
      title: "Google Ads account",
      dealerAction:
        "Create a Google Ads account with your business email. It takes a few minutes and you do not need to enter card details to create it — only before ads start running.",
      whyDealerMustDoIt:
        "An account has to exist before any access can be granted against it.",
      done: Boolean(p.googleCustomerId),
    })
    steps.push({
      kind: "link_google_manager",
      platform: "google",
      title: "Accept our management request",
      dealerAction:
        "You will get a request from us inside Google Ads. Accept it, and we can run campaigns for you without you logging in again.",
      whyDealerMustDoIt:
        "Google requires the client to accept a manager link from their own account. We can send the invitation but cannot approve it ourselves.",
      done: google.grant === "active",
    })
  }

  if (meta.ownership === "dealer_linked") {
    steps.push({
      kind: "create_meta_portfolio",
      platform: "meta",
      title: "Meta Business Portfolio",
      dealerAction:
        "Create a Business Portfolio at business.facebook.com. It is free and takes about two minutes.",
      whyDealerMustDoIt:
        "Meta ad accounts cannot be transferred between portfolios — ownership is permanent to whoever created it. If we create it, you can never move it to your own name later. So this one has to be done from your side.",
      done: Boolean(p.metaBusinessId),
    })
    steps.push({
      kind: "create_meta_page",
      platform: "meta",
      title: "Facebook Page for the dealership",
      dealerAction:
        "Create a Page for your dealership inside that Business Portfolio.",
      whyDealerMustDoIt:
        "Every Meta ad runs from a Page, and Meta requires the ad to represent the business being advertised — so it cannot run from our Page.",
      done: Boolean(p.metaPageId),
    })
    steps.push({
      kind: "create_meta_adaccount",
      platform: "meta",
      title: "Ad account",
      dealerAction:
        "Create an ad account in the same Business Portfolio. Set the country to India and the currency to INR.",
      whyDealerMustDoIt:
        "Country and currency are fixed at creation and cannot be changed afterwards. Getting this wrong means starting over.",
      done: Boolean(p.metaAdAccountId),
    })
    steps.push({
      kind: "grant_meta_partner_access",
      platform: "meta",
      title: "Give us partner access",
      dealerAction:
        "In Business Settings, go to Partners, choose 'Give a partner access to your assets', and enter our Business ID.",
      whyDealerMustDoIt:
        "Only the business that owns an asset can share it. We cannot grant ourselves access.",
      done: meta.grant === "active",
    })
  }

  if (google.billing === "agency_billed" || meta.billing === "agency_billed") {
    steps.push({
      kind: "share_payment_method",
      platform: meta.billing === "agency_billed" ? "meta" : "google",
      title: "Billing set to our account",
      dealerAction:
        "Nothing to do — we pay the platforms directly and invoice you separately.",
      whyDealerMustDoIt: null,
      done: true,
    })
  }

  return steps
}

export function onboardingProgress(dealer: Dealer): {
  total: number
  done: number
  complete: boolean
  nextStep: OnboardingStep | null
} {
  const steps = onboardingSteps(dealer)
  const done = steps.filter((s) => s.done).length
  return {
    total: steps.length,
    done,
    complete: steps.length > 0 && done === steps.length,
    nextStep: steps.find((s) => !s.done) ?? null,
  }
}

/**
 * The message an account manager sends over WhatsApp.
 *
 * Written for a dealer principal who is not technical: short, no jargon, says
 * what it is for and roughly how long it takes.
 */
export function whatsappMessage(dealer: Dealer, link: string): string {
  const { total, done } = onboardingProgress(dealer)
  const remaining = total - done

  return [
    `Hello ${dealer.name},`,
    "",
    "To start running your campaigns we need to connect your advertising accounts. " +
      `This link walks you through it — ${remaining} short step${remaining === 1 ? "" : "s"}, ` +
      "about ten minutes.",
    "",
    link,
    "",
    "You will own the accounts and keep everything in them. We run the campaigns for you " +
      "and handle the platform payments.",
    "",
    "Call us if anything is unclear and we will do it together on the phone.",
  ].join("\n")
}

/** Grants that need attention, worst first. */
export function grantHealth(dealers: Dealer[]): {
  dealer: Dealer
  platform: Platform
  state: GrantState
  lastVerifiedAt: string | null
  severity: number
}[] {
  const out: { dealer: Dealer; platform: Platform; state: GrantState; lastVerifiedAt: string | null; severity: number }[] = []

  for (const dealer of dealers) {
    for (const platform of ["google", "meta"] as Platform[]) {
      const acc = account(dealer, platform)
      if (acc.ownership !== "dealer_linked") continue

      // Revoked is worse than expired: expired is a token to refresh, revoked
      // means the dealer or one of their staff actively removed us.
      const severity =
        acc.grant === "revoked" ? 100
          : acc.grant === "expired" ? 80
          : acc.grant === "invited" ? 40
          : 0

      if (severity > 0) {
        out.push({
          dealer,
          platform,
          state: acc.grant,
          lastVerifiedAt: acc.lastVerifiedAt,
          severity,
        })
      }
    }
  }
  return out.sort((a, b) => b.severity - a.severity)
}
