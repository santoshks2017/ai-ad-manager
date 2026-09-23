import Link from "next/link"
import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { NewCampaignForm } from "./NewCampaignForm"
import type { ImageAsset } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function NewCampaign() {
  const store = await getStore()
  const dealers = await store.listDealers()
  // No image library yet, so Performance Max and Demand Gen will report what
  // they need rather than creating campaigns that cannot serve.
  const images: ImageAsset[] = []

  return (
    <Shell
      title="New campaign"
      subtitle="Set it up once; it goes to both platforms"
      actions={
        <Link href="/campaigns" className="btn-quiet">
          All campaigns
        </Link>
      }
    >
      <NewCampaignForm dealers={dealers} images={images} />
    </Shell>
  )
}
