import { NextResponse } from "next/server"
import { getStore } from "@/lib/store"
import { canOperate, currentUser } from "@/lib/session"
import {
  ACCEPTED_TYPES, MAX_BYTES, readDimensions, validateForRole, type ImageRole,
} from "@/lib/image"

const BUCKET = process.env.ASSET_BUCKET ?? "aiad-manager-assets"

/**
 * Upload an ad image for a showroom.
 *
 * Validated before storage, not after: a wrongly cropped Performance Max asset
 * does not fail loudly, it just stops the campaign serving well, and finding
 * that out a week later from a flat report is expensive.
 */
export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  if (!canOperate(user.role)) {
    return NextResponse.json(
      { error: "Only account managers and admins can upload assets." },
      { status: 403 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 })
  }

  const dealerId = String(form.get("dealerId") ?? "")
  const role = String(form.get("role") ?? "") as ImageRole
  const file = form.get("file")

  if (!dealerId || !role || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Pick a showroom, a role and a file." },
      { status: 400 },
    )
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `${file.type || "That file"} is not supported. Use a PNG, JPEG or WebP.` },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.` },
      { status: 400 },
    )
  }

  const store = await getStore()
  const dealer = await store.getDealer(dealerId)
  if (!dealer) return NextResponse.json({ error: "Showroom not found." }, { status: 404 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const dims = readDimensions(bytes)
  if (!dims) {
    return NextResponse.json(
      { error: "Could not read that image. It may be corrupt or an unsupported format." },
      { status: 400 },
    )
  }

  const check = validateForRole(role, dims)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 422 })
  }

  const objectPath = `showrooms/${dealer.code}/${role}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`

  try {
    const admin = await import("firebase-admin")
    const apps = admin.getApps?.() ?? []
    const app = apps.length
      ? apps[0]
      : admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })
    const { getStorage } = await import("firebase-admin/storage")
    const bucket = getStorage(app).bucket(BUCKET)

    await bucket.file(objectPath).save(Buffer.from(bytes), {
      contentType: file.type,
      // Assets are referenced by ad platforms for a long time; let CDNs hold
      // them, and rely on the unique path for cache busting.
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    })

    const image = await store.createImage({
      dealerId,
      role,
      url: `https://storage.googleapis.com/${BUCKET}/${objectPath}`,
      widthPx: dims.width,
      heightPx: dims.height,
      uploadedAt: new Date().toISOString(),
    })

    return NextResponse.json({ image }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: `Could not store the file: ${(err as Error).message}` },
      { status: 502 },
    )
  }
}
