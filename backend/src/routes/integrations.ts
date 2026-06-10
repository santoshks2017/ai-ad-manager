import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"
import { GoogleAdsService } from "../services/google-ads.js"
import { MetaAdsService } from "../services/meta-ads.js"
import { pool } from "../db.js"

const router = express.Router()

// List connected accounts
router.get("/accounts", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const dbRes = await pool.query(
      "SELECT platform, platform_account_id, account_name, connected_at FROM ad_accounts WHERE dealership_id = $1",
      [dealershipId]
    )
    res.json(dbRes.rows)
  } catch (err) {
    console.error("Failed to fetch ad accounts:", err)
    res.status(500).json({ error: "Database error" })
  }
})

// Google Auth URL
router.get("/google/auth-url", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const url = await GoogleAdsService.getAuthUrl(dealershipId)
    res.json({ url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Google OAuth Callback
router.post("/google/callback", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { code } = req.body

  if (!dealershipId || !code) {
    return res.status(400).json({ error: "Missing dealershipId or authorization code" })
  }

  try {
    const account = await GoogleAdsService.exchangeCode(code, dealershipId)
    res.json({ success: true, account })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Meta Auth URL
router.get("/meta/auth-url", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  if (!dealershipId) return res.status(400).json({ error: "No dealership associated" })

  try {
    const url = await MetaAdsService.getAuthUrl(dealershipId)
    res.json({ url })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Meta OAuth Callback
router.post("/meta/callback", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { code } = req.body

  if (!dealershipId || !code) {
    return res.status(400).json({ error: "Missing dealershipId or authorization code" })
  }

  try {
    const account = await MetaAdsService.exchangeCode(code, dealershipId)
    res.json({ success: true, account })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Disconnect Platform
router.delete("/:platform", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const dealershipId = req.user?.dealershipId
  const { platform } = req.params

  if (!dealershipId || (platform !== "google" && platform !== "meta")) {
    return res.status(400).json({ error: "Invalid request parameters" })
  }

  try {
    await pool.query(
      "DELETE FROM ad_accounts WHERE dealership_id = $1 AND platform = $2",
      [dealershipId, platform]
    )
    res.json({ success: true, message: `${platform} account disconnected` })
  } catch (err) {
    console.error(`Failed to disconnect ${platform}:`, err)
    res.status(500).json({ error: "Database error" })
  }
})

export default router
