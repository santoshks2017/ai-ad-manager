import { headers } from "next/headers"

/**
 * The public origin of this service.
 *
 * `new URL(request.url).origin` cannot be used here. Cloud Run terminates TLS
 * at its proxy and forwards to the container on 0.0.0.0:8080, so the request
 * URL carries the internal address. An OAuth redirect_uri built from it points
 * at a host that does not exist, and Meta rejects it anyway because the value
 * has to match the one registered on the app exactly.
 *
 * Resolution order: explicit config, then the proxy's forwarded headers.
 */
export async function publicOrigin(fallback?: string): Promise<string> {
  const configured = process.env.PUBLIC_ORIGIN
  if (configured) return configured.replace(/\/$/, "")

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("localhost:8080")) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
    return `${proto}://${host}`
  }

  return (fallback ?? "http://localhost:3100").replace(/\/$/, "")
}
