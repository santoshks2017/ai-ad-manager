import express from "express"

const router = express.Router()

router.get("/metrics", (_req, res) => {
  res.json({
    totalSpend: 0,
    totalLeads: 0,
    costPerLead: 0,
    activeCampaigns: 0,
    platformBreakdown: {
      google: { spend: 0, leads: 0 },
      meta: { spend: 0, leads: 0 },
    },
  })
})

export default router
