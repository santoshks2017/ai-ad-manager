import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"
import { pool } from "../db.js"

const router = express.Router()

router.get("/metrics", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  const { period, start, end } = req.query

  let startDate = new Date()
  let endDate = new Date()

  if (period === "today") {
    // start and end are today
    startDate.setHours(0, 0, 0, 0)
  } else if (period === "month") {
    startDate.setDate(endDate.getDate() - 30)
  } else if (period === "custom" && start && end) {
    startDate = new Date(start as string)
    endDate = new Date(end as string)
  } else {
    // Default to last 7 days (week)
    startDate.setDate(endDate.getDate() - 7)
  }

  try {
    // 1. Get platform split summaries
    const summaryRes = await pool.query(
      `SELECT 
         platform,
         SUM(spend)::float as spend,
         SUM(impressions)::int as impressions,
         SUM(clicks)::int as clicks,
         SUM(leads)::int as leads
       FROM metrics_cache
       WHERE dealership_id = $1 AND date >= $2 AND date <= $3
       GROUP BY platform`,
      [dealershipId, startDate, endDate]
    )

    // 2. Get active campaign counts
    const activeCampRes = await pool.query(
      "SELECT COUNT(*) as count FROM campaigns WHERE dealership_id = $1 AND status = 'active'",
      [dealershipId]
    )
    const activeCampaigns = parseInt(activeCampRes.rows[0].count, 10)

    // 3. Get daily trend for chart
    const trendRes = await pool.query(
      `SELECT 
         date::text as date,
         SUM(spend)::float as spend,
         SUM(leads)::int as leads
       FROM metrics_cache
       WHERE dealership_id = $1 AND date >= $2 AND date <= $3
       GROUP BY date
       ORDER BY date ASC`,
      [dealershipId, startDate, endDate]
    )

    // 4. Get campaigns performance table
    const campaignsRes = await pool.query(
      `SELECT 
         c.id,
         c.name,
         c.platforms,
         c.status,
         c.budget::float as budget,
         COALESCE(COUNT(l.id), 0)::int as leads,
         COALESCE(SUM(mc.spend), 0)::float as spend
       FROM campaigns c
       LEFT JOIN leads l ON c.id = l.campaign_id
       LEFT JOIN (
         -- Aggregate campaign spend from cache
         SELECT 
           dealership_id,
           platform,
           SUM(spend) as spend
         FROM metrics_cache
         WHERE date >= $2 AND date <= $3
         GROUP BY dealership_id, platform
       ) mc ON c.dealership_id = mc.dealership_id AND mc.platform = ANY(c.platforms)
       WHERE c.dealership_id = $1
       GROUP BY c.id
       ORDER BY leads DESC`,
      [dealershipId, startDate, endDate]
    )

    // Construct metrics structure
    let totalSpend = 0
    let totalLeads = 0
    const platformBreakdown: Record<string, { spend: number; leads: number }> = {
      google: { spend: 0, leads: 0 },
      meta: { spend: 0, leads: 0 }
    }

    summaryRes.rows.forEach((row) => {
      const p = row.platform
      if (p === "google" || p === "meta") {
        platformBreakdown[p] = {
          spend: row.spend || 0,
          leads: row.leads || 0
        }
        totalSpend += row.spend || 0
        totalLeads += row.leads || 0
      }
    })

    const costPerLead = totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0

    res.json({
      totalSpend: Math.round(totalSpend * 100) / 100,
      totalLeads,
      costPerLead,
      activeCampaigns,
      platformBreakdown,
      trend: trendRes.rows,
      campaigns: campaignsRes.rows
    })
  } catch (err) {
    console.error("Failed to fetch dashboard metrics:", err)
    res.status(500).json({ error: "Database error" })
  }
})

export default router
