import { describe, it, expect } from "vitest"
import { ROLE_SPECS, readDimensions, validateForRole } from "../image"

/** Minimal valid PNG header with the given dimensions. */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(32)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  const v = new DataView(b.buffer)
  v.setUint32(16, width)
  v.setUint32(20, height)
  return b
}

/** Minimal JPEG with an SOF0 segment. */
function jpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24)
  b[0] = 0xff; b[1] = 0xd8
  b[2] = 0xff; b[3] = 0xc0
  const v = new DataView(b.buffer)
  v.setUint16(4, 17)
  b[6] = 8
  v.setUint16(7, height)
  v.setUint16(9, width)
  return b
}

describe("reading dimensions from the header", () => {
  it("reads a PNG", () => {
    expect(readDimensions(png(1200, 628))).toEqual({
      width: 1200, height: 628, format: "png",
    })
  })

  it("reads a JPEG", () => {
    const d = readDimensions(jpeg(1200, 1200))
    expect(d?.width).toBe(1200)
    expect(d?.height).toBe(1200)
    expect(d?.format).toBe("jpeg")
  })

  it("returns null for something that is not an image", () => {
    expect(readDimensions(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull()
  })

  it("does not throw on a truncated file", () => {
    expect(() => readDimensions(new Uint8Array([0xff, 0xd8]))).not.toThrow()
  })
})

describe("landscape assets", () => {
  it("accepts a correctly cropped 1.91:1 image", () => {
    expect(validateForRole("landscape", readDimensions(png(1200, 628))!).ok).toBe(true)
  })

  it("rejects one that is too small even at the right ratio", () => {
    const r = validateForRole("landscape", readDimensions(png(382, 200))!)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/at least 600 × 314/)
  })

  it("rejects a square image offered as landscape", () => {
    const r = validateForRole("landscape", readDimensions(png(1200, 1200))!)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/1\.91:1/)
  })

  it("explains what happens if you ignore the ratio", () => {
    const r = validateForRole("landscape", readDimensions(png(1200, 1200))!)
    expect(r.error).toMatch(/cut the car in half/)
  })

  it("tolerates a pixel or two of rounding", () => {
    // 1200/628 = 1.9108, which is not exactly 1.91.
    expect(validateForRole("landscape", readDimensions(png(1200, 627))!).ok).toBe(true)
  })
})

describe("square and logo assets", () => {
  it("accepts a true square", () => {
    expect(validateForRole("square", readDimensions(png(1200, 1200))!).ok).toBe(true)
  })

  it("rejects a near-square that is not square", () => {
    expect(validateForRole("square", readDimensions(png(1200, 1000))!).ok).toBe(false)
  })

  it("lets a logo be smaller than a content square", () => {
    // 128 is fine for a logo and far too small for a square content image.
    expect(validateForRole("logo", readDimensions(png(128, 128))!).ok).toBe(true)
    expect(validateForRole("square", readDimensions(png(128, 128))!).ok).toBe(false)
  })
})

describe("the specs themselves", () => {
  it("says which campaign types each role feeds", () => {
    expect(ROLE_SPECS.landscape.usedBy).toMatch(/Performance Max/)
    expect(ROLE_SPECS.portrait.usedBy).toMatch(/optional/i)
  })
})
