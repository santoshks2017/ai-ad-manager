import Link from "next/link"
import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { NewCampaignForm } from "./NewCampaignForm"

export const dynamic = "force-dynamic"

export default async function NewCampaign() {
  const store = await getStore()
  const dealers = await store.listDealers()

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
      <NewCampaignForm dealers={dealers} />
    </Shell>
  )
}
