import { getStore } from "@/lib/store"
import type { LeadStatus } from "@/lib/types"

/** CSV of the currently filtered leads, for handing to a showroom. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const store = await getStore()

  const leads = await store.listLeads({
    dealerId: url.searchParams.get("dealer") || undefined,
    platform: url.searchParams.get("platform") || undefined,
    status: (url.searchParams.get("status") as LeadStatus) || undefined,
  })
  const dealers = await store.listDealers()
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase()

  const rows = q
    ? leads.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")),
      )
    : leads

  const esc = (v: string | null) => {
    const s = v ?? ""
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const header = [
    "Received", "Showroom", "Name", "Phone", "Email", "Model", "City",
    "Platform", "Source", "Status", "Notes",
  ].join(",")

  const body = rows.map((l) =>
    [
      l.receivedAt,
      esc(dealers.find((d) => d.id === l.dealerId)?.name ?? ""),
      esc(l.name), esc(l.phone), esc(l.email), esc(l.model), esc(l.city),
      l.platform, l.source, l.status, esc(l.notes),
    ].join(","),
  )

  return new Response([header, ...body].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
