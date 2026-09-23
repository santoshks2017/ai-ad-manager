/**
 * Image validation for ad assets.
 *
 * Google rejects or silently under-delivers assets that miss its aspect ratios
 * and minimum sizes, and a Performance Max campaign with bad imagery does not
 * fail loudly — it just stops serving well. So dimensions are checked before
 * anything is stored, and the error says exactly what is wrong and what would
 * be acceptable.
 *
 * Dimensions are parsed from the file header rather than with an image
 * library. The headers are a few dozen bytes and stable; pulling in a native
 * dependency to read six integers would be a poor trade on a serverless
 * runtime.
 */

import type { ImageAsset } from "./types"

export type ImageRole = ImageAsset["role"]

export interface RoleSpec {
  role: ImageRole
  label: string
  /** width / height */
  ratio: number
  ratioLabel: string
  minWidth: number
  minHeight: number
  recommended: string
  usedBy: string
}

export const ROLE_SPECS: Record<ImageRole, RoleSpec> = {
  landscape: {
    role: "landscape",
    label: "Landscape",
    ratio: 1.91,
    ratioLabel: "1.91:1",
    minWidth: 600,
    minHeight: 314,
    recommended: "1200 × 628",
    usedBy: "Performance Max, Demand Gen",
  },
  square: {
    role: "square",
    label: "Square",
    ratio: 1,
    ratioLabel: "1:1",
    minWidth: 300,
    minHeight: 300,
    recommended: "1200 × 1200",
    usedBy: "Performance Max, Demand Gen",
  },
  logo: {
    role: "logo",
    label: "Logo",
    ratio: 1,
    ratioLabel: "1:1",
    minWidth: 128,
    minHeight: 128,
    recommended: "1200 × 1200",
    usedBy: "Performance Max, Demand Gen",
  },
  portrait: {
    role: "portrait",
    label: "Portrait",
    ratio: 0.8,
    ratioLabel: "4:5",
    minWidth: 480,
    minHeight: 600,
    recommended: "960 × 1200",
    usedBy: "Demand Gen (optional)",
  },
}

/** Google crops a little, but not much. Beyond this the subject gets cut. */
const RATIO_TOLERANCE = 0.03

export interface Dimensions {
  width: number
  height: number
  format: "png" | "jpeg" | "webp" | "gif"
}

/** Read width and height from the file header. Null when unrecognised. */
export function readDimensions(buf: Uint8Array): Dimensions | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
  if (
    buf.length > 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20), format: "png" }
  }

  // GIF: "GIF87a"/"GIF89a", then little-endian uint16 width/height.
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return {
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
      format: "gif",
    }
  }

  // WebP: RIFF container. VP8X and VP8L encode size differently from VP8.
  if (
    buf.length > 30 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    const chunk = String.fromCharCode(buf[12], buf[13], buf[14], buf[15])
    if (chunk === "VP8X") {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16))
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16))
      return { width: w, height: h, format: "webp" }
    }
    if (chunk === "VP8 ") {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
        format: "webp",
      }
    }
    if (chunk === "VP8L") {
      const b = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24)
      return {
        width: (b & 0x3fff) + 1,
        height: ((b >> 14) & 0x3fff) + 1,
        format: "webp",
      }
    }
  }

  // JPEG: walk the segment markers to the start-of-frame, which carries size.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = buf[offset + 1]
      // SOF0-SOF15, excluding the non-frame markers in that range.
      if (
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      ) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
          format: "jpeg",
        }
      }
      offset += 2 + view.getUint16(offset + 2)
    }
  }

  return null
}

export interface ValidationResult {
  ok: boolean
  error?: string
}

export function validateForRole(
  role: ImageRole,
  dims: Dimensions,
): ValidationResult {
  const spec = ROLE_SPECS[role]

  if (dims.width < spec.minWidth || dims.height < spec.minHeight) {
    return {
      ok: false,
      error: `This is ${dims.width} × ${dims.height}. A ${spec.label.toLowerCase()} asset needs at least ${spec.minWidth} × ${spec.minHeight}; ${spec.recommended} works best.`,
    }
  }

  const actual = dims.width / dims.height
  const drift = Math.abs(actual - spec.ratio) / spec.ratio
  if (drift > RATIO_TOLERANCE) {
    return {
      ok: false,
      error: `This is ${dims.width} × ${dims.height}, which is roughly ${actual.toFixed(2)}:1. A ${spec.label.toLowerCase()} asset has to be ${spec.ratioLabel} — crop it before uploading, or Google will crop it for you and cut the car in half.`,
    }
  }

  return { ok: true }
}

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const MAX_BYTES = 5 * 1024 * 1024
