import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"
import { GoogleAdsService } from "../services/google-ads.js"
import { MetaAdsService } from "../services/meta-ads.js"
import { pool } from "../db.js"

const router = express.Router()

const CAMPAIGN_TEMPLATES = [
  {
    id: "model_launch",
    name: "Model Launch",
    icon: "🚗",
    headline: "The All-New {model} is Here!",
    description: "Experience luxury and performance like never before. Bookings open now at special launch prices. Visit our Pune showroom today!",
    cta: "Book Now"
  },
  {
    id: "test_drive",
    name: "Test Drive Offer",
    icon: "🧪",
    headline: "Book Doorstep Test Drive of {model}",
    description: "Love driving? Book a doorstep test drive of the all-new {model} this weekend. Flexible slots, completely free. Register now!",
    cta: "Book Test Drive"
  },
  {
    id: "exchange",
    name: "Exchange Offer",
    icon: "🔁",
    headline: "Get Up To ₹50,000 Exchange Bonus on {model}!",
    description: "Upgrade your ride today. Bring in your old car and walk away with a brand new {model}. Get best-in-market valuation. Limited time offer!",
    cta: "Get Valuation"
  },
  {
    id: "festive",
    name: "Festive Sale",
    icon: "🎉",
    headline: "Celebrate the Season with a New {model}",
    description: "Special festive discounts, 100% on-road financing, and free accessories with every {model} purchase this week. Drive home happiness!",
    cta: "View Offers"
  },
  {
    id: "clearance",
    name: "Year-End Clearance",
    icon: "📅",
    headline: "Year-End Stock Clearance: Save Big on {model}!",
    description: "Unbeatable clearance deals on pre-facelift {model} models. Massive cash discounts and free extended warranty. Valid till stocks last!",
    cta: "Get Deal"
  }
]

// Get templates
router.get("/templates", authMiddleware, (req, res) => {
  res.json(CAMPAIGN_TEMPLATES)
})

// List campaigns
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const dbRes = await pool.query(
      `SELECT 
         c.id,
         c.name,
         c.template_type as "templateType",
         c.car_model as "carModel",
         c.offer_text as "offerText",
         c.budget::float as budget,
         c.start_date::text as "startDate",
         c.end_date::text as "endDate",
         c.target_location as "targetLocation",
         c.status,
         c.platforms,
         c.created_at as "createdAt",
         COALESCE(COUNT(l.id), 0)::int as leads
       FROM campaigns c
       LEFT JOIN leads l ON c.id = l.campaign_id
       WHERE c.dealership_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [dealershipId]
    )
    res.json(dbRes.rows)
  } catch (err) {
    console.error("Failed to list campaigns:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Create campaign
router.post("/create", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  const { name, templateType, carModel, offerText, budget, startDate, endDate, targetLocation, platforms } = req.body

  if (!name || !budget || !startDate || !endDate || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  try {
    // 1. Verify ad accounts are connected for selected platforms
    const accountsRes = await pool.query(
      "SELECT platform FROM ad_accounts WHERE dealership_id = $1 AND platform = ANY($2)",
      [dealershipId, platforms]
    )
    const connectedPlatforms = accountsRes.rows.map(r => r.platform)
    const missing = platforms.filter(p => !connectedPlatforms.includes(p))

    if (missing.length > 0) {
      return res.status(400).json({ error: `Ad account not connected for: ${missing.join(", ")}` })
    }

    // 2. Launch on Google Ads if selected
    let googleCampaignId: string | null = null
    if (platforms.includes("google")) {
      googleCampaignId = await GoogleAdsService.createCampaign(dealershipId, {
        name,
        carModel,
        offerText,
        budget,
        startDate,
        endDate,
        targetLocation
      })
    }

    // 3. Launch on Meta Ads if selected
    let metaCampaignId: string | null = null
    if (platforms.includes("meta")) {
      metaCampaignId = await MetaAdsService.createCampaign(dealershipId, {
        name,
        carModel,
        offerText,
        budget,
        startDate,
        endDate,
        targetLocation
      })
    }

    // 4. Save to database
    const insertRes = await pool.query(
      `INSERT INTO campaigns (dealership_id, name, template_type, car_model, offer_text, budget, start_date, end_date, target_location, status, google_campaign_id, meta_campaign_id, platforms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, $11, $12)
       RETURNING id, name, status, platforms`,
      [dealershipId, name, templateType, carModel, offerText, budget, startDate, endDate, targetLocation, googleCampaignId, metaCampaignId, platforms]
    )

    res.json({ success: true, campaign: insertRes.rows[0] })
  } catch (err: any) {
    console.error("Failed to create campaign:", err)
    res.status(500).json({ error: err.message || "Failed to launch campaign" })
  }
})

// Pause campaign
router.patch("/:id/pause", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { id } = req.params

  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const campRes = await pool.query(
      "SELECT id, google_campaign_id, meta_campaign_id, platforms FROM campaigns WHERE id = $1 AND dealership_id = $2",
      [id, dealershipId]
    )
    const campaign = campRes.rows[0]
    if (!campaign) return res.status(404).json({ error: "Campaign not found" })

    // Pause on Google Ads
    if (campaign.platforms.includes("google") && campaign.google_campaign_id) {
      await GoogleAdsService.pauseCampaign(campaign.google_campaign_id)
    }

    // Pause on Meta Ads
    if (campaign.platforms.includes("meta") && campaign.meta_campaign_id) {
      await MetaAdsService.pauseCampaign(campaign.meta_campaign_id)
    }

    // Update in DB
    await pool.query(
      "UPDATE campaigns SET status = 'paused' WHERE id = $1 AND dealership_id = $2",
      [id, dealershipId]
    )

    res.json({ success: true, message: "Campaign paused" })
  } catch (err: any) {
    console.error("Failed to pause campaign:", err)
    res.status(500).json({ error: err.message || "Database error" })
  }
})

// Resume campaign
router.patch("/:id/resume", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { id } = req.params

  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const campRes = await pool.query(
      "SELECT id, google_campaign_id, meta_campaign_id, platforms FROM campaigns WHERE id = $1 AND dealership_id = $2",
      [id, dealershipId]
    )
    const campaign = campRes.rows[0]
    if (!campaign) return res.status(404).json({ error: "Campaign not found" })

    // Resume on Google Ads
    if (campaign.platforms.includes("google") && campaign.google_campaign_id) {
      await GoogleAdsService.resumeCampaign(campaign.google_campaign_id)
    }

    // Resume on Meta Ads
    if (campaign.platforms.includes("meta") && campaign.meta_campaign_id) {
      await MetaAdsService.resumeCampaign(campaign.meta_campaign_id)
    }

    // Update in DB
    await pool.query(
      "UPDATE campaigns SET status = 'active' WHERE id = $1 AND dealership_id = $2",
      [id, dealershipId]
    )

    res.json({ success: true, message: "Campaign resumed" })
  } catch (err: any) {
    console.error("Failed to resume campaign:", err)
    res.status(500).json({ error: err.message || "Database error" })
  }
})

export default router
