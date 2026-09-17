import { describe, it, expect } from "vitest"
import { onboardToken, verifyOnboardToken } from "../onboard-link"

describe("signed onboarding links", () => {
  it("round-trips a dealer id", () => {
    const token = onboardToken("dlr_apxhyd")
    expect(verifyOnboardToken(token)).toBe("dlr_apxhyd")
  })

  it("rejects a bare dealer id — this is the enumeration it exists to stop", () => {
    expect(verifyOnboardToken("dlr_apxhyd")).toBeNull()
  })

  it("rejects a tampered signature", () => {
    const token = onboardToken("dlr_apxhyd")
    const [id] = token.split(".")
    expect(verifyOnboardToken(`${id}.0000000000000000`)).toBeNull()
  })

  it("rejects one dealer's signature reused for another", () => {
    const sig = onboardToken("dlr_apxhyd").split(".")[1]
    expect(verifyOnboardToken(`dlr_setmah.${sig}`)).toBeNull()
  })

  it("rejects malformed input without throwing", () => {
    for (const bad of ["", ".", "abc", ".sig", "dlr_x.", "....."]) {
      expect(() => verifyOnboardToken(bad)).not.toThrow()
      expect(verifyOnboardToken(bad)).toBeNull()
    }
  })

  it("is stable, so a link sent yesterday still works today", () => {
    expect(onboardToken("dlr_apxhyd")).toBe(onboardToken("dlr_apxhyd"))
  })

  it("gives different dealers different tokens", () => {
    expect(onboardToken("dlr_a")).not.toBe(onboardToken("dlr_b"))
  })
})
