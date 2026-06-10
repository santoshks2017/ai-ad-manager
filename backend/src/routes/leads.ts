import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"
import { pool } from "../db.js"

const router = express.Router()

// List leads (filterable, sortable, paginated)
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  const { status, platform, campaignId, search, page = 1, limit = 50 } = req.query

  const offset = (Number(page) - 1) * Number(limit)
  
  let queryStr = `
    SELECT 
      l.id,
      l.platform,
      l.name,
      l.phone,
      l.email,
      l.status,
      l.notes,
      l.received_at as "receivedAt",
      c.name as "campaignName"
    FROM leads l
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    WHERE l.dealership_id = $1
  `
  const params: any[] = [dealershipId]
  let paramIdx = 2

  if (status && status !== "all") {
    queryStr += ` AND l.status = $${paramIdx}`
    params.push(status)
    paramIdx++
  }

  if (platform && platform !== "all") {
    queryStr += ` AND l.platform = $${paramIdx}`
    params.push(platform)
    paramIdx++
  }

  if (campaignId && campaignId !== "all") {
    queryStr += ` AND l.campaign_id = $${paramIdx}`
    params.push(campaignId)
    paramIdx++
  }

  if (search) {
    queryStr += ` AND (l.name ILIKE $${paramIdx} OR l.phone ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx})`
    params.push(`%${search}%`)
    paramIdx++
  }

  // Count total matching
  let countQueryStr = queryStr.replace(
    `l.id,
      l.platform,
      l.name,
      l.phone,
      l.email,
      l.status,
      l.notes,
      l.received_at as "receivedAt",
      c.name as "campaignName"`,
    "COUNT(*)::int as count"
  )

  // Add sorting and pagination to list query
  queryStr += ` ORDER BY l.received_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`
  params.push(Number(limit), Number(offset))

  try {
    const listRes = await pool.query(queryStr, params)
    const countRes = await pool.query(countQueryStr, params.slice(0, paramIdx - 1))
    const total = countRes.rows[0]?.count || 0

    res.json({
      leads: listRes.rows,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    })
  } catch (err) {
    console.error("Failed to query leads:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Export CSV
router.get("/export", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  const { status, platform, campaignId, search } = req.query

  let queryStr = `
    SELECT 
      l.name,
      l.phone,
      l.email,
      l.platform,
      l.status,
      l.notes,
      l.received_at as "receivedAt",
      c.name as "campaignName"
    FROM leads l
    LEFT JOIN campaigns c ON l.campaign_id = c.id
    WHERE l.dealership_id = $1
  `
  const params: any[] = [dealershipId]
  let paramIdx = 2

  if (status && status !== "all") {
    queryStr += ` AND l.status = $${paramIdx}`
    params.push(status)
    paramIdx++
  }

  if (platform && platform !== "all") {
    queryStr += ` AND l.platform = $${paramIdx}`
    params.push(platform)
    paramIdx++
  }

  if (campaignId && campaignId !== "all") {
    queryStr += ` AND l.campaign_id = $${paramIdx}`
    params.push(campaignId)
    paramIdx++
  }

  if (search) {
    queryStr += ` AND (l.name ILIKE $${paramIdx} OR l.phone ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx})`
    params.push(`%${search}%`)
    paramIdx++
  }

  queryStr += " ORDER BY l.received_at DESC"

  try {
    const dbRes = await pool.query(queryStr, params)
    
    // Generate CSV
    const headers = ["Name", "Phone", "Email", "Platform", "Status", "Notes", "Received At", "Campaign"]
    const rows = dbRes.rows.map(r => [
      r.name || "",
      r.phone || "",
      r.email || "",
      r.platform || "",
      r.status || "",
      r.notes || "",
      r.receivedAt ? new Date(r.receivedAt).toISOString() : "",
      r.campaignName || ""
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n")

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv")
    res.send(csvContent)
  } catch (err) {
    console.error("Failed to export leads:", err)
    res.status(500).json({ error: "Failed to generate CSV" })
  }
})

// Get lead detail
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { id } = req.params

  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const dbRes = await pool.query(
      `SELECT 
         l.id,
         l.platform,
         l.name,
         l.phone,
         l.email,
         l.status,
         l.notes,
         l.received_at as "receivedAt",
         c.name as "campaignName"
       FROM leads l
       LEFT JOIN campaigns c ON l.campaign_id = c.id
       WHERE l.id = $1 AND l.dealership_id = $2`,
      [id, dealershipId]
    )
    const lead = dbRes.rows[0]
    if (!lead) return res.status(404).json({ error: "Lead not found" })
    res.json(lead)
  } catch (err) {
    console.error("Failed to fetch lead details:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Update lead status or notes
router.patch("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { id } = req.params
  const { status, notes } = req.body

  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    let updateFields: string[] = []
    let params: any[] = [id, dealershipId]
    let paramIdx = 3

    if (status) {
      updateFields.push(`status = $${paramIdx}`)
      params.push(status)
      paramIdx++
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIdx}`)
      params.push(notes)
      paramIdx++
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" })
    }

    const updateQuery = `
      UPDATE leads 
      SET ${updateFields.join(", ")} 
      WHERE id = $1 AND dealership_id = $2 
      RETURNING id, status, notes
    `
    const dbRes = await pool.query(updateQuery, params)
    const updated = dbRes.rows[0]

    if (!updated) return res.status(404).json({ error: "Lead not found" })
    res.json({ success: true, lead: updated })
  } catch (err) {
    console.error("Failed to update lead:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Mock Meta Webhook for Sandbox Mode
router.post("/webhooks/meta/leads", async (req, res) => {
  // Real webhook needs Meta validation, sandbox accepts any lead
  const { name, phone, email, campaign_id, dealership_id } = req.body

  try {
    const dealerId = dealership_id || "22222222-2222-2222-2222-222222222222"
    const campId = campaign_id || "33333333-3333-3333-3333-333333333333"

    await pool.query(
      `INSERT INTO leads (dealership_id, campaign_id, platform, platform_lead_id, name, phone, email, status)
       VALUES ($1, $2, 'meta', $3, $4, $5, $6, 'new')`,
      [dealerId, campId, `meta_hook_${Date.now()}`, name, phone, email]
    )

    res.json({ success: true, message: "Lead ingested" })
  } catch (err) {
    console.error("Meta Webhook ingestion failed:", err)
    res.status(500).json({ error: "Ingestion error" })
  }
})

// Mock Google Webhook / Ingestion Trigger for Sandbox
router.post("/webhooks/google/leads", async (req, res) => {
  const { name, phone, email, campaign_id, dealership_id } = req.body

  try {
    const dealerId = dealership_id || "22222222-2222-2222-2222-222222222222"
    const campId = campaign_id || "33333333-3333-3333-3333-333333333333"

    await pool.query(
      `INSERT INTO leads (dealership_id, campaign_id, platform, platform_lead_id, name, phone, email, status)
       VALUES ($1, $2, 'google', $3, $4, $5, $6, 'new')`,
      [dealerId, campId, `google_hook_${Date.now()}`, name, phone, email]
    )

    res.json({ success: true, message: "Lead ingested" })
  } catch (err) {
    console.error("Google Webhook ingestion failed:", err)
    res.status(500).json({ error: "Ingestion error" })
  }
})

export default router
