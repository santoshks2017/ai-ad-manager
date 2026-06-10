import { pool } from "../db.js"
import { MOCK_DEALERSHIP_ID } from "../middleware/authMiddleware.js"

const INDIAN_FIRST_NAMES = [
  "Rajesh", "Sunita", "Anil", "Deepa", "Sanjay", "Kiran", "Vikram", "Neha", 
  "Aravind", "Meera", "Vijay", "Pooja", "Ramesh", "Gita", "Suresh", "Lata"
]

const INDIAN_LAST_NAMES = [
  "Sharma", "Patel", "Joshi", "Deshmukh", "Shinde", "Yadav", "Kulkarni", 
  "Singh", "Nair", "Iyer", "Rao", "Gupta", "Chatterjee", "Sen", "Bhat"
]

const CAR_MODELS = ["Maruti Swift", "Maruti Brezza", "Hyundai Creta"]

export function startMetricsSyncSimulator() {
  if (process.env.SANDBOX_MODE !== "true") {
    console.log("Sandbox mode disabled. Sync metrics simulator not started.")
    return
  }

  console.log("Starting Sandbox Metrics and Leads Simulator...")

  // Run every 60 seconds
  setInterval(async () => {
    try {
      const today = new Date()

      // 1. Fetch campaigns for dealership
      const campRes = await pool.query(
        "SELECT id, google_campaign_id, meta_campaign_id, platforms, car_model FROM campaigns WHERE dealership_id = $1 AND status = 'active'",
        [MOCK_DEALERSHIP_ID]
      )
      const activeCampaigns = campRes.rows

      if (activeCampaigns.length === 0) return

      // Pick a random active campaign
      const campaign = activeCampaigns[Math.floor(Math.random() * activeCampaigns.length)]
      const platform = campaign.platforms[Math.floor(Math.random() * campaign.platforms.length)]

      // 2. Increment metrics_cache for today
      const checkRes = await pool.query(
        "SELECT id, spend, impressions, clicks, leads FROM metrics_cache WHERE dealership_id = $1 AND platform = $2 AND date = CURRENT_DATE",
        [MOCK_DEALERSHIP_ID, platform]
      )

      const spendIncrement = Math.round((50 + Math.random() * 80) * 100) / 100
      const impressionsIncrement = Math.round(spendIncrement * (platform === "google" ? 12 : 22))
      const clicksIncrement = Math.round(impressionsIncrement * (platform === "google" ? 0.06 : 0.03))
      
      // Roll a die to see if a lead is generated (e.g., 40% chance every minute)
      const isLeadGenerated = Math.random() < 0.4
      const leadsIncrement = isLeadGenerated ? 1 : 0

      if (checkRes.rows.length === 0) {
        // Insert for today
        const cpl = leadsIncrement > 0 ? spendIncrement : 0
        await pool.query(
          `INSERT INTO metrics_cache (dealership_id, platform, date, spend, impressions, clicks, leads, cpl)
           VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7)`,
          [MOCK_DEALERSHIP_ID, platform, spendIncrement, impressionsIncrement, clicksIncrement, leadsIncrement, cpl]
        )
      } else {
        // Update for today
        const cur = checkRes.rows[0]
        const newSpend = Math.round((cur.spend + spendIncrement) * 100) / 100
        const newImps = cur.impressions + impressionsIncrement
        const newClicks = cur.clicks + clicksIncrement
        const newLeads = cur.leads + leadsIncrement
        const newCpl = newLeads > 0 ? Math.round((newSpend / newLeads) * 100) / 100 : 0

        await pool.query(
          `UPDATE metrics_cache 
           SET spend = $1, impressions = $2, clicks = $3, leads = $4, cpl = $5
           WHERE id = $6`,
          [newSpend, newImps, newClicks, newLeads, newCpl, cur.id]
        )
      }

      // 3. Insert lead into DB if generated
      if (isLeadGenerated) {
        const firstName = INDIAN_FIRST_NAMES[Math.floor(Math.random() * INDIAN_FIRST_NAMES.length)]
        const lastName = INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)]
        const name = `${firstName} ${lastName}`
        const phone = `+91 ${90000 + Math.floor(Math.random() * 9999)} ${10000 + Math.floor(Math.random() * 89999)}`
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`
        const leadId = `mock_lead_${Date.now()}`

        await pool.query(
          `INSERT INTO leads (dealership_id, campaign_id, platform, platform_lead_id, name, phone, email, status, received_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', NOW())`,
          [MOCK_DEALERSHIP_ID, campaign.id, platform, leadId, name, phone, email]
        )

        console.log(`[Simulator] Fresh lead ingested: ${name} (${platform}) for campaign ${campaign.id}`)
      }

      // 4. Budget cap checking alert simulation
      // Compare current spend in this month to set caps
      const budgetRes = await pool.query(
        `SELECT monthly_cap, alert_75_email, alert_95_email FROM budget_settings 
         WHERE dealership_id = $1 AND platform = $2`,
        [MOCK_DEALERSHIP_ID, platform]
      )

      if (budgetRes.rows.length > 0) {
        const settings = budgetRes.rows[0]
        const cap = parseFloat(settings.monthly_cap)

        const spendSumRes = await pool.query(
          `SELECT SUM(spend) as spend FROM metrics_cache 
           WHERE dealership_id = $1 AND platform = $2 
             AND date >= DATE_TRUNC('month', CURRENT_DATE) AND date <= CURRENT_DATE`,
          [MOCK_DEALERSHIP_ID, platform]
        )
        const currentMonthSpend = parseFloat(spendSumRes.rows[0].spend || "0")

        if (cap > 0) {
          const ratio = currentMonthSpend / cap
          if (ratio >= 0.95 && settings.alert_95_email) {
            console.log(`[ALERT] Budget alert triggered! Spend on ${platform} is at 95%+ of cap! Current: ₹${currentMonthSpend}, Cap: ₹${cap}`)
          } else if (ratio >= 0.75 && settings.alert_75_email) {
            console.log(`[ALERT] Budget alert triggered! Spend on ${platform} is at 75%+ of cap! Current: ₹${currentMonthSpend}, Cap: ₹${cap}`)
          }
        }
      }

    } catch (err) {
      console.error("Error in Metrics Ingestion Simulator:", err)
    }
  }, 60000)
}
