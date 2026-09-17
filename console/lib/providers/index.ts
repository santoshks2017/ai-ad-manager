/**
 * Provider selection.
 *
 * Returns the live provider when it has credentials, and the simulator when it
 * does not. The choice is reported rather than hidden: `providerStatus()` backs
 * the badge in the UI so nobody has to guess whether a screen is showing real
 * delivery.
 */

import type { Platform } from "../types"
import { GoogleAdsProvider } from "./google"
import { MetaAdsProvider } from "./meta"
import { SimulatedProvider } from "./simulated"
import type { AdProvider } from "./types"

export function getProvider(platform: Platform): AdProvider {
  const live: AdProvider =
    platform === "google" ? new GoogleAdsProvider() : new MetaAdsProvider()
  return live.isConfigured() ? live : new SimulatedProvider(platform)
}

export function providerStatus(): {
  platform: Platform
  live: boolean
  reason: string
}[] {
  return (["google", "meta"] as Platform[]).map((platform) => {
    const live = platform === "google" ? new GoogleAdsProvider() : new MetaAdsProvider()
    const configured = live.isConfigured()
    return {
      platform,
      live: configured,
      reason: configured
        ? "Credentials present. Calls go to the real API."
        : platform === "google"
          ? "No developer token yet. Using simulated delivery."
          : "No app access token yet. Using simulated delivery.",
    }
  })
}

export * from "./types"
export { SimulatedProvider, GoogleAdsProvider, MetaAdsProvider }
