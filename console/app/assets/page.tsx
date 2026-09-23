import { Shell } from "@/components/Shell"
import { getStore } from "@/lib/store"
import { AssetLibrary } from "./AssetLibrary"

export const dynamic = "force-dynamic"

export default async function Assets({
  searchParams,
}: {
  searchParams: Promise<{ dealer?: string }>
}) {
  const sp = await searchParams
  const store = await getStore()
  const [dealers, images] = await Promise.all([
    store.listDealers(),
    store.listImages(),
  ])

  const selected =
    dealers.find((d) => d.id === sp.dealer)?.id ?? dealers[0]?.id ?? ""

  return (
    <Shell
      title="Creative"
      subtitle="Images each showroom's ads can use"
    >
      <div className="card p-4 mb-6 text-sm text-ink-soft max-w-3xl">
        <span className="font-medium text-ink">
          Performance Max and Demand Gen will not serve properly without these.
        </span>{" "}
        Google accepts a campaign with missing or badly cropped imagery and then
        quietly under-delivers, so everything here is checked against the aspect
        ratio and minimum size before it is stored. Search campaigns need none of it.
      </div>

      {dealers.length === 0 ? (
        <div className="sheet p-10 text-center">
          <div className="font-display font-bold text-lg">No showrooms yet</div>
          <p className="text-sm text-ink-soft mt-2">Add a showroom first.</p>
        </div>
      ) : (
        <AssetLibrary
          dealers={dealers}
          images={images}
          selectedDealerId={selected}
        />
      )}
    </Shell>
  )
}
