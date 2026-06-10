import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"
import { pool } from "../db.js"
import { generateAndSendReport } from "../services/report-generator.js"

const router = express.Router()

// List past 12 reports
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const dbRes = await pool.query(
      `SELECT 
         r.id,
         r.period_start::text as "periodStart",
         r.period_end::text as "periodEnd",
         r.total_spend::float as "totalSpend",
         r.total_leads::int as "totalLeads",
         r.cpl::float as cpl,
         r.insight_text as "insightText",
         r.pdf_url as "pdfUrl",
         r.sent_at as "sentAt",
         c.name as "topCampaignName"
       FROM reports r
       LEFT JOIN campaigns c ON r.top_campaign_id = c.id
       WHERE r.dealership_id = $1
       ORDER BY r.period_start DESC
       LIMIT 12`,
      [dealershipId]
    )
    res.json(dbRes.rows)
  } catch (err) {
    console.error("Failed to list reports:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Fetch single report details
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { id } = req.params

  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const dbRes = await pool.query(
      `SELECT 
         r.id,
         r.period_start::text as "periodStart",
         r.period_end::text as "periodEnd",
         r.total_spend::float as "totalSpend",
         r.total_leads::int as "totalLeads",
         r.cpl::float as cpl,
         r.insight_text as "insightText",
         r.pdf_url as "pdfUrl",
         r.sent_at as "sentAt",
         c.name as "topCampaignName"
       FROM reports r
       LEFT JOIN campaigns c ON r.top_campaign_id = c.id
       WHERE r.id = $1 AND r.dealership_id = $2`,
      [id, dealershipId]
    )
    const report = dbRes.rows[0]
    if (!report) return res.status(404).json({ error: "Report not found" })
    res.json(report)
  } catch (err) {
    console.error("Failed to fetch report details:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Trigger immediate send of latest report
router.post("/send-now", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const email = req.user?.email

  if (!dealershipId || !email) {
    return res.status(400).json({ error: "Missing dealership context or email" })
  }

  try {
    const success = await generateAndSendReport(dealershipId, email)
    if (success) {
      res.json({ success: true, message: `Report generated and dispatched to ${email}` })
    } else {
      res.status(500).json({ error: "Failed to compile weekly report data" })
    }
  } catch (err: any) {
    console.error("Failed to trigger report delivery:", err)
    res.status(500).json({ error: err.message || "Failed to deliver report" })
  }
})

export default router
