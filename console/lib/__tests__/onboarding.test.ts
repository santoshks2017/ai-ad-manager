import { describe, it, expect } from "vitest"
import { grantHealth, onboardingProgress, onboardingSteps, whatsappMessage } from "../onboarding"
import type { Dealer, GrantState, OwnershipMode } from "../types"

function acct(
  ownership: OwnershipMode = "dealer_linked",
  grant: GrantState = "not_requested",
) {
  return {
    ownership,
    billing: "agency_billed" as const,
    grant,
    lastVerifiedAt: null,
  }
}

function dealer(over: Partial<Dealer> = {}): Dealer {
  return {
    id: "d1", code: "TEST", name: "Test Motors", city: "Lucknow", state: "UP",
    brands: ["Hyundai"], models: ["Creta"], monthlyBudget: 100_000,
    committedCpl: 400, virtualNumber: null, landingPageUrl: null,
    lmsAccountRef: null, status: "active", ownerId: null,
    platform: {
      googleCustomerId: null, googleState: "not_started", googleVerified: false,
      google: acct(),
      metaBusinessId: null, metaPageId: null, metaAdAccountId: null,
      metaState: "not_started", metaVerified: false, meta: acct(),
      servicesAgreementSigned: true, legalDocsCollected: true,
    },
    createdAt: "", updatedAt: "", ...over,
  }
}

describe("onboarding steps", () => {
  it("asks nothing of a dealer whose accounts we own", () => {
    const d = dealer()
    d.platform.google = acct("agency_owned")
    d.platform.meta = acct("agency_owned")
    // Only the billing note remains, which requires no dealer action.
    const steps = onboardingSteps(d).filter((s) => s.whyDealerMustDoIt !== null)
    expect(steps).toHaveLength(0)
  })

  it("puts account creation before the access grant", () => {
    const steps = onboardingSteps(dealer())
    const create = steps.findIndex((s) => s.kind === "create_google_account")
    const link = steps.findIndex((s) => s.kind === "link_google_manager")
    expect(create).toBeLessThan(link)
  })

  it("requires a Meta portfolio, Page and ad account before partner access", () => {
    const steps = onboardingSteps(dealer()).map((s) => s.kind)
    expect(steps.indexOf("create_meta_portfolio"))
      .toBeLessThan(steps.indexOf("grant_meta_partner_access"))
    expect(steps.indexOf("create_meta_page"))
      .toBeLessThan(steps.indexOf("grant_meta_partner_access"))
    expect(steps.indexOf("create_meta_adaccount"))
      .toBeLessThan(steps.indexOf("grant_meta_partner_access"))
  })

  it("explains that Meta ownership cannot be transferred later", () => {
    const step = onboardingSteps(dealer()).find((s) => s.kind === "create_meta_portfolio")!
    expect(step.whyDealerMustDoIt).toMatch(/cannot be transferred|never move/i)
  })

  it("warns that Meta country and currency are fixed at creation", () => {
    const step = onboardingSteps(dealer()).find((s) => s.kind === "create_meta_adaccount")!
    expect(step.whyDealerMustDoIt).toMatch(/cannot be changed/i)
  })

  it("says we cannot approve a Google manager link ourselves", () => {
    const step = onboardingSteps(dealer()).find((s) => s.kind === "link_google_manager")!
    expect(step.whyDealerMustDoIt).toMatch(/cannot approve it ourselves/i)
  })

  it("marks a step done once the asset id is on record", () => {
    const d = dealer()
    d.platform.metaBusinessId = "bm_1"
    const step = onboardingSteps(d).find((s) => s.kind === "create_meta_portfolio")!
    expect(step.done).toBe(true)
  })

  it("only treats an active grant as done, not an invited one", () => {
    const d = dealer()
    d.platform.meta = acct("dealer_linked", "invited")
    expect(onboardingSteps(d).find((s) => s.kind === "grant_meta_partner_access")!.done)
      .toBe(false)
    d.platform.meta = acct("dealer_linked", "active")
    expect(onboardingSteps(d).find((s) => s.kind === "grant_meta_partner_access")!.done)
      .toBe(true)
  })
})

describe("progress", () => {
  it("reports the next outstanding step", () => {
    const p = onboardingProgress(dealer())
    expect(p.complete).toBe(false)
    expect(p.nextStep?.kind).toBe("create_google_account")
  })

  it("is complete only when every step is done", () => {
    const d = dealer()
    d.platform.googleCustomerId = "g1"
    d.platform.google = acct("dealer_linked", "active")
    d.platform.metaBusinessId = "bm1"
    d.platform.metaPageId = "p1"
    d.platform.metaAdAccountId = "a1"
    d.platform.meta = acct("dealer_linked", "active")
    expect(onboardingProgress(d).complete).toBe(true)
    expect(onboardingProgress(d).nextStep).toBeNull()
  })
})

describe("whatsapp message", () => {
  it("names the dealer and carries the link", () => {
    const msg = whatsappMessage(dealer(), "https://example.in/onboard/abc")
    expect(msg).toContain("Test Motors")
    expect(msg).toContain("https://example.in/onboard/abc")
  })

  it("tells the dealer they keep ownership", () => {
    expect(whatsappMessage(dealer(), "x")).toMatch(/own the accounts/i)
  })

  it("avoids jargon a dealer principal would not know", () => {
    const msg = whatsappMessage(dealer(), "x").toLowerCase()
    for (const word of ["oauth", "api", "token", "portfolio id", "mcc", "scope"]) {
      expect(msg).not.toContain(word)
    }
  })

  it("counts only the steps still outstanding", () => {
    const d = dealer()
    d.platform.googleCustomerId = "g1"
    const msg = whatsappMessage(d, "x")
    const { total, done } = onboardingProgress(d)
    expect(msg).toContain(String(total - done))
  })
})

describe("grant health", () => {
  it("ranks a revoked grant above an expired one", () => {
    const revoked = dealer({ id: "a", code: "A" })
    revoked.platform.meta = acct("dealer_linked", "revoked")
    const expired = dealer({ id: "b", code: "B" })
    expired.platform.meta = acct("dealer_linked", "expired")

    const health = grantHealth([expired, revoked])
    expect(health[0].dealer.id).toBe("a")
    expect(health[0].state).toBe("revoked")
  })

  it("ignores accounts we own — there is no grant to lose", () => {
    const d = dealer()
    d.platform.google = acct("agency_owned")
    d.platform.meta = acct("agency_owned")
    expect(grantHealth([d])).toHaveLength(0)
  })

  it("says nothing about a healthy active grant", () => {
    const d = dealer()
    d.platform.google = acct("dealer_linked", "active")
    d.platform.meta = acct("dealer_linked", "active")
    expect(grantHealth([d])).toHaveLength(0)
  })

  it("surfaces an invited grant that was never completed", () => {
    const d = dealer()
    d.platform.google = acct("dealer_linked", "invited")
    d.platform.meta = acct("agency_owned")
    const health = grantHealth([d])
    expect(health).toHaveLength(1)
    expect(health[0].state).toBe("invited")
  })
})

describe("records written before ownership existed", () => {
  /**
   * Firestore is schemaless, so dealer documents written before ownership and
   * billing were added simply lack those fields. Reading them used to throw and
   * took the whole page down in production. They are treated as what they
   * actually were: agency-owned and agency-billed.
   */
  function legacyDealer(): Dealer {
    const d = dealer()
    delete (d.platform as Record<string, unknown>).google
    delete (d.platform as Record<string, unknown>).meta
    return d
  }

  it("does not throw on a record with no ownership fields", () => {
    expect(() => onboardingSteps(legacyDealer())).not.toThrow()
  })

  it("treats a legacy record as agency-owned, so it asks the dealer for nothing", () => {
    const steps = onboardingSteps(legacyDealer()).filter(
      (s) => s.whyDealerMustDoIt !== null,
    )
    expect(steps).toHaveLength(0)
  })

  it("reports no grant problems for a legacy record", () => {
    expect(() => grantHealth([legacyDealer()])).not.toThrow()
    expect(grantHealth([legacyDealer()])).toHaveLength(0)
  })

  it("survives a record with no platform object at all", () => {
    const d = dealer()
    delete (d as Record<string, unknown>).platform
    expect(() => onboardingSteps(d)).not.toThrow()
    expect(() => grantHealth([d])).not.toThrow()
  })
})
