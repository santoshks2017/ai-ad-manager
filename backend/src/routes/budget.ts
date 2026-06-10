import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"
import { GoogleAdsService } from "../services/google-ads.js"
import { MetaAdsService } from "../services/meta-ads.js"
import { pool } from "../db.js"

const router = express.Router()

// Get budget settings and current spend progress
router.get("/settings", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    // 1. Fetch caps and alerts
    const settingsRes = await pool.query(
      `SELECT 
         platform, 
         monthly_cap::float as "monthlyCap",
         alert_75_email as "alert75Email",
         alert_95_email as "alert95Email",
         alert_95_sms as "alert95Sms",
         phone_for_sms as "phoneForSms"
       FROM budget_settings
       WHERE dealership_id = $1`,
      [dealershipId]
    )

    // 2. Fetch current month's actual spend from cache
    const spendRes = await pool.query(
      `SELECT 
         platform, 
         COALESCE(SUM(spend), 0)::float as spend
       FROM metrics_cache
       WHERE dealership_id = $1 
         AND date >= DATE_TRUNC('month', CURRENT_DATE)
         AND date <= CURRENT_DATE
       GROUP BY platform`,
      [dealershipId]
    )

    // Map spend
    const spendMap: Record<string, number> = { google: 0, meta: 0 }
    spendRes.rows.forEach(r => {
      spendMap[r.platform] = r.spend
    })

    // Construct response structure
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const daysElapsed = new Date().getDate()

    const settings = ["google", "meta"].map(platform => {
      const dbSetting = settingsRes.rows.find(r => r.platform === platform) || {
        monthlyCap: platform === "google" ? 100000 : 80000,
        alert75Email: true,
        alert95Email: true,
        alert95Sms: true,
        phoneForSms: ""
      }

      const spent = spendMap[platform] || 0
      const cap = dbSetting.monthlyCap
      const progress = cap > 0 ? Math.round((spent / cap) * 100) : 0
      const projected = daysElapsed > 0 ? Math.round((spent / daysElapsed) * daysInMonth * 100) / 100 : spent

      return {
        platform,
        monthlyCap: cap,
        spent: Math.round(spent * 100) / 100,
        progress,
        projected,
        status: progress >= 95 ? "critical" : progress >= 75 ? "warning" : "on_track",
        alert75Email: dbSetting.alert75Email,
        alert95Email: dbSetting.alert95Email,
        alert95Sms: dbSetting.alert95Sms,
        phoneForSms: dbSetting.phoneForSms
      }
    })

    res.json(settings)
  } catch (err) {
    console.error("Failed to fetch budget settings:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Update caps and preferences
router.put("/settings", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  const { platform, monthlyCap, alert75Email, alert95Email, alert95Sms, phoneForSms } = req.body

  if (!platform || (platform !== "google" && platform !== "meta")) {
    return res.status(400).json({ error: "Invalid platform" })
  }

  try {
    await pool.query(
      `INSERT INTO budget_settings (dealership_id, platform, monthly_cap, alert_75_email, alert_95_email, alert_95_sms, phone_for_sms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (dealership_id, platform) 
       DO UPDATE SET 
         monthly_cap = EXCLUDED.monthly_cap,
         alert_75_email = EXCLUDED.alert_75_email,
         alert_95_email = EXCLUDED.alert_95_email,
         alert_95_sms = EXCLUDED.alert_95_sms,
         phone_for_sms = EXCLUDED.phone_for_sms`,
      [dealershipId, platform, monthlyCap || 0, alert75Email ?? true, alert95Email ?? true, alert95Sms ?? true, phoneForSms || ""]
    )

    res.json({ success: true, message: "Settings updated successfully" })
  } catch (err) {
    console.error("Failed to update budget settings:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Emergency pause all campaigns
router.post("/pause-all", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    // 1. Fetch all active campaigns
    const activeCampRes = await pool.query(
      "SELECT id, google_campaign_id, meta_campaign_id, platforms FROM campaigns WHERE dealership_id = $1 AND status = 'active'",
      [dealershipId]
    )
    const campaigns = activeCampRes.rows

    // 2. Pause them one by one via service adapters
    for (const campaign of campaigns) {
      if (campaign.platforms.includes("google") && campaign.google_campaign_id) {
        await GoogleAdsService.pauseCampaign(campaign.google_campaign_id)
      }
      if (campaign.platforms.includes("meta") && campaign.meta_campaign_id) {
        await MetaAdsService.pauseCampaign(campaign.meta_campaign_id)
      }
    }

    // 3. Bulk update campaign statuses in DB
    await pool.query(
      "UPDATE campaigns SET status = 'paused' WHERE dealership_id = $1 AND status = 'active'",
      [dealershipId]
    )

    res.json({ success: true, message: `Successfully paused ${campaigns.length} active campaigns.` })
  } catch (err) {
    console.error("Failed to emergency pause campaigns:", err)
    res.status(500).json({ error: "Emergency suspension failed" })
  }
})

export default router
