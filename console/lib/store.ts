/**
 * Storage layer.
 *
 * Two implementations behind one interface:
 *   - FirestoreStore: production, via Application Default Credentials.
 *   - MemoryStore:    local dev and demo, seeded with realistic data.
 *
 * The fallback is deliberate. Firestore needs a configured project and
 * credentials; without the fallback the app is unrunnable locally and
 * undemonstrable before that setup lands. The active mode is reported by
 * `storeMode()` and surfaced in the UI — it is never silent.
 */

import type {
  Audit, Campaign, Dealer, Lead, LeadStatus, MetricsDaily, Optimization, Order,
  Projection, User,
} from "./types"

export interface Store {
  listDealers(): Promise<Dealer[]>
  getDealer(id: string): Promise<Dealer | null>
  createDealer(d: Omit<Dealer, "id" | "createdAt" | "updatedAt">): Promise<Dealer>
  updateDealer(id: string, patch: Partial<Dealer>): Promise<Dealer | null>

  listProjections(limit?: number): Promise<Projection[]>
  getProjection(id: string): Promise<Projection | null>
  createProjection(p: Omit<Projection, "id" | "createdAt">): Promise<Projection>

  listOrders(status?: Order["status"]): Promise<Order[]>
  getOrder(id: string): Promise<Order | null>
  createOrder(o: Omit<Order, "id">): Promise<Order>
  updateOrder(id: string, patch: Partial<Order>): Promise<Order | null>

  listCampaigns(dealerId?: string): Promise<Campaign[]>
  createCampaign(c: Omit<Campaign, "id" | "createdAt">): Promise<Campaign>
  updateCampaign(id: string, patch: Partial<Campaign>): Promise<Campaign | null>

  listMetrics(dealerId?: string, from?: string, to?: string): Promise<MetricsDaily[]>
  upsertMetrics(m: MetricsDaily): Promise<void>

  listOptimizations(status?: Optimization["status"]): Promise<Optimization[]>
  createOptimization(o: Omit<Optimization, "id" | "createdAt">): Promise<Optimization>
  updateOptimization(id: string, patch: Partial<Optimization>): Promise<Optimization | null>

  listLeads(filter?: {
    dealerId?: string
    platform?: string
    status?: LeadStatus
    campaignId?: string
    from?: string
    to?: string
  }): Promise<Lead[]>
  createLead(l: Omit<Lead, "id">): Promise<Lead>
  updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null>

  listAudits(dealerId?: string): Promise<Audit[]>
  createAudit(a: Omit<Audit, "id">): Promise<Audit>
  updateAudit(id: string, patch: Partial<Audit>): Promise<Audit | null>

  listUsers(): Promise<User[]>
  createUser(u: User): Promise<void>
  /**
   * Delete every record. Only ever called by the seed endpoint, which refuses
   * to run when any record carries provenance "live".
   */
  wipe(): Promise<void>
}

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

/**
 * Stable id derived from a natural key.
 *
 * The in-memory store is constructed per module instance, and Next.js can load
 * a route handler and a page in separate instances. With random ids the page
 * rendered one set of dealers while the API held another, so every write from
 * the UI failed with "not found". Deriving ids from the dealer code makes the
 * seeded data identical in every instance, and makes the demo reproducible.
 */
function stableId(prefix: string, key: string): string {
  return `${prefix}_${key.toLowerCase().replace(/[^a-z0-9]+/g, "")}`
}

const now = () => new Date().toISOString()

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

class MemoryStore implements Store {
  dealers: Dealer[] = []
  projections: Projection[] = []
  orders: Order[] = []
  campaigns: Campaign[] = []
  metrics: MetricsDaily[] = []
  optimizations: Optimization[] = []
  audits: Audit[] = []
  leads: Lead[] = []
  users: User[] = []

  async listDealers() {
    return [...this.dealers].sort((a, b) => a.name.localeCompare(b.name))
  }
  async getDealer(i: string) {
    return this.dealers.find((d) => d.id === i) ?? null
  }
  async createDealer(d: Omit<Dealer, "id" | "createdAt" | "updatedAt">) {
    const rec: Dealer = {
      ...d,
      id: d.code ? stableId("dlr", d.code) : id("dlr"),
      createdAt: now(),
      updatedAt: now(),
    }
    this.dealers.push(rec)
    return rec
  }
  async updateDealer(i: string, patch: Partial<Dealer>) {
    const idx = this.dealers.findIndex((d) => d.id === i)
    if (idx === -1) return null
    this.dealers[idx] = { ...this.dealers[idx], ...patch, updatedAt: now() }
    return this.dealers[idx]
  }

  async listProjections(limit = 50) {
    return [...this.projections]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }
  async getProjection(i: string) {
    return this.projections.find((p) => p.id === i) ?? null
  }
  async createProjection(p: Omit<Projection, "id" | "createdAt">) {
    const rec: Projection = { ...p, id: id("prj"), createdAt: now() }
    this.projections.unshift(rec)
    return rec
  }

  async listOrders(status?: Order["status"]) {
    const all = [...this.orders].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return status ? all.filter((o) => o.status === status) : all
  }
  async getOrder(i: string) {
    return this.orders.find((o) => o.id === i) ?? null
  }
  async createOrder(o: Omit<Order, "id">) {
    const rec: Order = { ...o, id: id("ord") }
    this.orders.unshift(rec)
    return rec
  }
  async updateOrder(i: string, patch: Partial<Order>) {
    const idx = this.orders.findIndex((o) => o.id === i)
    if (idx === -1) return null
    this.orders[idx] = { ...this.orders[idx], ...patch }
    return this.orders[idx]
  }

  async listCampaigns(dealerId?: string) {
    const all = [...this.campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return dealerId ? all.filter((c) => c.dealerId === dealerId) : all
  }
  async createCampaign(c: Omit<Campaign, "id" | "createdAt">) {
    const rec: Campaign = {
      ...c,
      id: c.platformCampaignId ? stableId("cmp", c.platformCampaignId) : id("cmp"),
      createdAt: now(),
    }
    this.campaigns.unshift(rec)
    return rec
  }
  async updateCampaign(i: string, patch: Partial<Campaign>) {
    const idx = this.campaigns.findIndex((c) => c.id === i)
    if (idx === -1) return null
    this.campaigns[idx] = { ...this.campaigns[idx], ...patch }
    return this.campaigns[idx]
  }

  async listMetrics(dealerId?: string, from?: string, to?: string) {
    return this.metrics.filter(
      (m) =>
        (!dealerId || m.dealerId === dealerId) &&
        (!from || m.date >= from) &&
        (!to || m.date <= to),
    )
  }
  async upsertMetrics(m: MetricsDaily) {
    const idx = this.metrics.findIndex((x) => x.id === m.id)
    if (idx === -1) this.metrics.push(m)
    else this.metrics[idx] = m
  }

  async listOptimizations(status?: Optimization["status"]) {
    const all = [...this.optimizations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return status ? all.filter((o) => o.status === status) : all
  }
  async createOptimization(o: Omit<Optimization, "id" | "createdAt">) {
    const rec: Optimization = { ...o, id: id("opt"), createdAt: now() }
    this.optimizations.unshift(rec)
    return rec
  }
  async updateOptimization(i: string, patch: Partial<Optimization>) {
    const idx = this.optimizations.findIndex((o) => o.id === i)
    if (idx === -1) return null
    this.optimizations[idx] = { ...this.optimizations[idx], ...patch }
    return this.optimizations[idx]
  }

  async listLeads(f: {
    dealerId?: string; platform?: string; status?: LeadStatus
    campaignId?: string; from?: string; to?: string
  } = {}) {
    return this.leads
      .filter(
        (l) =>
          (!f.dealerId || l.dealerId === f.dealerId) &&
          (!f.platform || l.platform === f.platform) &&
          (!f.status || l.status === f.status) &&
          (!f.campaignId || l.campaignId === f.campaignId) &&
          (!f.from || l.receivedAt >= f.from) &&
          (!f.to || l.receivedAt <= f.to),
      )
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }
  async createLead(l: Omit<Lead, "id">) {
    const rec: Lead = { ...l, id: id("led") }
    this.leads.unshift(rec)
    return rec
  }
  async updateLead(i: string, patch: Partial<Lead>) {
    const idx = this.leads.findIndex((l) => l.id === i)
    if (idx === -1) return null
    this.leads[idx] = { ...this.leads[idx], ...patch }
    return this.leads[idx]
  }

  async listAudits(dealerId?: string) {
    const all = [...this.audits].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return dealerId ? all.filter((a) => a.dealerId === dealerId) : all
  }
  async createAudit(a: Omit<Audit, "id">) {
    const rec: Audit = { ...a, id: id("aud") }
    this.audits.unshift(rec)
    return rec
  }
  async updateAudit(i: string, patch: Partial<Audit>) {
    const idx = this.audits.findIndex((a) => a.id === i)
    if (idx === -1) return null
    this.audits[idx] = { ...this.audits[idx], ...patch }
    return this.audits[idx]
  }

  async listUsers() {
    return this.users
  }
  async createUser(u: User) {
    const idx = this.users.findIndex((x) => x.id === u.id)
    if (idx === -1) this.users.push(u)
    else this.users[idx] = u
  }
  async wipe() {
    this.leads = []
    this.audits = []
    this.dealers = []
    this.projections = []
    this.orders = []
    this.campaigns = []
    this.metrics = []
    this.optimizations = []
    this.users = []
  }
}

// ---------------------------------------------------------------------------
// Firestore implementation
// ---------------------------------------------------------------------------

type FirestoreLike = {
  collection: (name: string) => any
}

class FirestoreStore implements Store {
  constructor(private db: FirestoreLike) {}

  private col(name: string) {
    return this.db.collection(name)
  }
  private async all<T>(name: string): Promise<T[]> {
    const snap = await this.col(name).get()
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T)
  }
  private async one<T>(name: string, i: string): Promise<T | null> {
    const doc = await this.col(name).doc(i).get()
    return doc.exists ? ({ id: doc.id, ...doc.data() } as T) : null
  }
  private async add<T>(name: string, data: any): Promise<T> {
    const ref = await this.col(name).add(data)
    return { id: ref.id, ...data } as T
  }
  private async patch<T>(name: string, i: string, p: any): Promise<T | null> {
    const ref = this.col(name).doc(i)
    const doc = await ref.get()
    if (!doc.exists) return null
    await ref.set(p, { merge: true })
    const updated = await ref.get()
    return { id: updated.id, ...updated.data() } as T
  }

  async listDealers() {
    return (await this.all<Dealer>("dealers")).sort((a, b) => a.name.localeCompare(b.name))
  }
  async getDealer(i: string) { return this.one<Dealer>("dealers", i) }
  async createDealer(d: Omit<Dealer, "id" | "createdAt" | "updatedAt">) {
    // Use the dealer code as the document id, matching the in-memory store.
    // Auto-generated ids differ between the two, which meant an onboarding link
    // built against one store 404'd against the other. A dealer code is already
    // unique and is what appears in campaign names anyway.
    const data = { ...d, createdAt: now(), updatedAt: now() }
    if (!d.code) return this.add<Dealer>("dealers", data)

    const id = stableId("dlr", d.code)
    await this.col("dealers").doc(id).set(data, { merge: true })
    return { id, ...data } as Dealer
  }
  async updateDealer(i: string, p: Partial<Dealer>) {
    return this.patch<Dealer>("dealers", i, { ...p, updatedAt: now() })
  }

  async listProjections(limit = 50) {
    const snap = await this.col("projections").orderBy("createdAt", "desc").limit(limit).get()
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as Projection)
  }
  async getProjection(i: string) { return this.one<Projection>("projections", i) }
  async createProjection(p: Omit<Projection, "id" | "createdAt">) {
    return this.add<Projection>("projections", { ...p, createdAt: now() })
  }

  async listOrders(status?: Order["status"]) {
    let q = this.col("orders")
    if (status) q = q.where("status", "==", status)
    const snap = await q.get()
    return snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }) as Order)
      .sort((a: Order, b: Order) => b.submittedAt.localeCompare(a.submittedAt))
  }
  async getOrder(i: string) { return this.one<Order>("orders", i) }
  async createOrder(o: Omit<Order, "id">) { return this.add<Order>("orders", o) }
  async updateOrder(i: string, p: Partial<Order>) { return this.patch<Order>("orders", i, p) }

  async listCampaigns(dealerId?: string) {
    let q = this.col("campaigns")
    if (dealerId) q = q.where("dealerId", "==", dealerId)
    const snap = await q.get()
    return snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }) as Campaign)
      .sort((a: Campaign, b: Campaign) => b.createdAt.localeCompare(a.createdAt))
  }
  async createCampaign(c: Omit<Campaign, "id" | "createdAt">) {
    return this.add<Campaign>("campaigns", { ...c, createdAt: now() })
  }
  async updateCampaign(i: string, p: Partial<Campaign>) {
    return this.patch<Campaign>("campaigns", i, p)
  }

  async listMetrics(dealerId?: string, from?: string, to?: string) {
    // Filter server-side. Firestore bills per document returned, so pulling the
    // whole collection and filtering in memory turns one optimisation scan into
    // thousands of billable reads.
    let q = this.col("metricsDaily")
    if (dealerId) q = q.where("dealerId", "==", dealerId)
    if (from) q = q.where("date", ">=", from)
    if (to) q = q.where("date", "<=", to)
    const snap = await q.get()
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }) as MetricsDaily)
  }
  async upsertMetrics(m: MetricsDaily) {
    await this.col("metricsDaily").doc(m.id).set(m, { merge: true })
  }

  async listOptimizations(status?: Optimization["status"]) {
    let q = this.col("optimizations")
    if (status) q = q.where("status", "==", status)
    const snap = await q.get()
    return snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }) as Optimization)
      .sort((a: Optimization, b: Optimization) => b.createdAt.localeCompare(a.createdAt))
  }
  async createOptimization(o: Omit<Optimization, "id" | "createdAt">) {
    return this.add<Optimization>("optimizations", { ...o, createdAt: now() })
  }
  async updateOptimization(i: string, p: Partial<Optimization>) {
    return this.patch<Optimization>("optimizations", i, p)
  }

  async listLeads(f: {
    dealerId?: string; platform?: string; status?: LeadStatus
    campaignId?: string; from?: string; to?: string
  } = {}) {
    let q = this.col("leads")
    // Filter server-side where Firestore allows it; equality filters compose
    // freely, so the common cases cost only the documents they return.
    if (f.dealerId) q = q.where("dealerId", "==", f.dealerId)
    if (f.platform) q = q.where("platform", "==", f.platform)
    if (f.status) q = q.where("status", "==", f.status)
    if (f.campaignId) q = q.where("campaignId", "==", f.campaignId)
    const snap = await q.get()
    return snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }) as Lead)
      .filter(
        (l: Lead) =>
          (!f.from || l.receivedAt >= f.from) && (!f.to || l.receivedAt <= f.to),
      )
      .sort((a: Lead, b: Lead) => b.receivedAt.localeCompare(a.receivedAt))
  }
  async createLead(l: Omit<Lead, "id">) { return this.add<Lead>("leads", l) }
  async updateLead(i: string, p: Partial<Lead>) { return this.patch<Lead>("leads", i, p) }

  async listAudits(dealerId?: string) {
    let q = this.col("audits")
    if (dealerId) q = q.where("dealerId", "==", dealerId)
    const snap = await q.get()
    return snap.docs
      .map((d: any) => ({ id: d.id, ...d.data() }) as Audit)
      .sort((a: Audit, b: Audit) => b.createdAt.localeCompare(a.createdAt))
  }
  async createAudit(a: Omit<Audit, "id">) { return this.add<Audit>("audits", a) }
  async updateAudit(i: string, p: Partial<Audit>) { return this.patch<Audit>("audits", i, p) }

  async listUsers() { return this.all<User>("users") }
  async createUser(u: User) {
    await this.col("users").doc(u.id).set(u, { merge: true })
  }
  async wipe() {
    for (const name of [
      "dealers", "projections", "orders", "campaigns",
      "metricsDaily", "optimizations", "audits", "leads", "users",
    ]) {
      // Firestore has no "delete collection"; batch through the documents.
      let snap = await this.col(name).limit(400).get()
      while (!snap.empty) {
        await Promise.all(snap.docs.map((d: any) => d.ref.delete()))
        snap = await this.col(name).limit(400).get()
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

let cached: Store | null = null
let mode: "firestore" | "memory" = "memory"

/** Which store is live. Surfaced in the UI so demo data is never mistaken for real. */
export function storeMode(): "firestore" | "memory" {
  return mode
}

export async function getStore(): Promise<Store> {
  if (cached) return cached

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT

  if (projectId && process.env.USE_FIRESTORE !== "false") {
    try {
      const admin = await import("firebase-admin")
      const apps = admin.getApps?.() ?? []
      const app = apps.length ? apps[0] : admin.initializeApp({ projectId })
      const { getFirestore } = await import("firebase-admin/firestore")
      const db = getFirestore(app)
      // Force a round trip so misconfiguration fails here, not mid-request.
      await db.collection("_healthcheck").limit(1).get()
      cached = new FirestoreStore(db as unknown as FirestoreLike)
      mode = "firestore"
      return cached
    } catch (err) {
      console.warn(
        `[store] Firestore unavailable (${(err as Error).message}); using seeded in-memory store.`,
      )
    }
  }

  const mem = new MemoryStore()
  const { seed } = await import("./seed")
  await seed(mem)
  cached = mem
  mode = "memory"
  return cached
}

export { MemoryStore }
