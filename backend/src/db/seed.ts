import { pool } from "../db.js"
import { MOCK_USER_ID, MOCK_DEALERSHIP_ID } from "../middleware/authMiddleware.js"

export async function seedDatabase() {
  console.log("Seeding database with mock data...")

  // 1. Ensure Dealership and User exist
  const dealerRes = await pool.query("SELECT id FROM dealerships WHERE id = $1", [MOCK_DEALERSHIP_ID])
  if (dealerRes.rows.length === 0) {
    await pool.query("INSERT INTO dealerships (id, name) VALUES ($1, $2)", [MOCK_DEALERSHIP_ID, "Pune Maruti Suzuki"])
  }

  const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [MOCK_USER_ID])
  if (userRes.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (id, email, name, role, dealership_id) VALUES ($1, $2, $3, $4, $5)",
      [MOCK_USER_ID, "santosh@pune-maruti.com", "Santosh Sharma", "owner", MOCK_DEALERSHIP_ID]
    )
  }

  // 2. Ensure Connected Accounts exist in Sandbox mode
  const accountsRes = await pool.query("SELECT id FROM ad_accounts WHERE dealership_id = $1", [MOCK_DEALERSHIP_ID])
  if (accountsRes.rows.length === 0) {
    await pool.query(
      `INSERT INTO ad_accounts (dealership_id, platform, platform_account_id, account_name, access_token)
       VALUES 
       ($1, 'google', 'g_acc_9876543210', 'Pune Maruti Google Ads', 'mock_google_access_token'),
       ($1, 'meta', 'm_acc_4567890123', 'Pune Maruti Meta Ads', 'mock_meta_access_token')`,
      [MOCK_DEALERSHIP_ID]
    )
  }

  // 3. Ensure Budget Settings exist
  const budgetRes = await pool.query("SELECT id FROM budget_settings WHERE dealership_id = $1", [MOCK_DEALERSHIP_ID])
  if (budgetRes.rows.length === 0) {
    await pool.query(
      `INSERT INTO budget_settings (dealership_id, platform, monthly_cap, alert_75_email, alert_95_email, alert_95_sms, phone_for_sms)
       VALUES 
       ($1, 'google', 100000.00, true, true, true, '+919876543210'),
       ($1, 'meta', 80000.00, true, true, true, '+919876543210')`,
      [MOCK_DEALERSHIP_ID]
    )
  }

  // 4. Ensure Campaigns exist
  const campCount = await pool.query("SELECT COUNT(*) FROM campaigns WHERE dealership_id = $1", [MOCK_DEALERSHIP_ID])
  const hasCampaigns = parseInt(campCount.rows[0].count, 10) > 0
  
  let campDiwaliId = "33333333-3333-3333-3333-333333333333"
  let campWeekendId = "44444444-4444-4444-4444-444444444444"
  let campCretaId = "55555555-5555-5555-5555-555555555555"

  if (!hasCampaigns) {
    // Diwali Exchange Offer (Google + Meta)
    await pool.query(
      `INSERT INTO campaigns (id, dealership_id, name, template_type, car_model, offer_text, budget, start_date, end_date, target_location, status, google_campaign_id, meta_campaign_id, platforms)
       VALUES ($1, $2, 'Diwali Exchange Offer', 'exchange', 'Maruti Swift', 'Get up to ₹50,000 exchange bonus on Swift!', 60000.00, NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 'Pune, Maharashtra', 'active', 'g_camp_diwali_123', 'm_camp_diwali_456', ARRAY['google', 'meta'])`,
      [campDiwaliId, MOCK_DEALERSHIP_ID]
    )

    // Test Drive Weekend (Meta)
    await pool.query(
      `INSERT INTO campaigns (id, dealership_id, name, template_type, car_model, offer_text, budget, start_date, end_date, target_location, status, google_campaign_id, meta_campaign_id, platforms)
       VALUES ($1, $2, 'Test Drive Weekend', 'test_drive', 'Maruti Brezza', 'Book a doorstep test drive of Brezza this weekend.', 30000.00, NOW() - INTERVAL '10 days', NOW() + INTERVAL '4 days', 'Pune, Maharashtra', 'active', NULL, 'm_camp_weekend_789', ARRAY['meta'])`,
      [campWeekendId, MOCK_DEALERSHIP_ID]
    )

    // Creta Model Launch (Google)
    await pool.query(
      `INSERT INTO campaigns (id, dealership_id, name, template_type, car_model, offer_text, budget, start_date, end_date, target_location, status, google_campaign_id, meta_campaign_id, platforms)
       VALUES ($1, $2, 'Creta Model Launch', 'model_launch', 'Hyundai Creta', 'The all-new Creta is here. Book now!', 50000.00, NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days', 'Pune, Maharashtra', 'paused', 'g_camp_creta_111', NULL, ARRAY['google'])`,
      [campCretaId, MOCK_DEALERSHIP_ID]
    )
  }

  // 5. Ensure Leads exist
  const leadCount = await pool.query("SELECT COUNT(*) FROM leads WHERE dealership_id = $1", [MOCK_DEALERSHIP_ID])
  if (parseInt(leadCount.rows[0].count, 10) === 0) {
    const mockLeads = [
      { name: "Rahul Deshmukh", phone: "+91 98230 12345", email: "rahul@gmail.com", platform: "google", campaign_id: campDiwaliId, status: "new", notes: "Interested in Swift VXI exchange." },
      { name: "Priya Kulkarni", phone: "+91 91234 56789", email: "priya.k@yahoo.com", platform: "meta", campaign_id: campWeekendId, status: "contacted", notes: "Called. Wants Brezza automatic test drive on Saturday." },
      { name: "Rohit Shinde", phone: "+91 99887 66554", email: "rohit_shinde@hotmail.com", platform: "google", campaign_id: campCretaId, status: "qualified", notes: "Budget OK, docs verified. Exchange with Swift." },
      { name: "Anjali Joshi", phone: "+91 98901 23456", email: "anjali@joshi.co.in", platform: "meta", campaign_id: campDiwaliId, status: "new", notes: "Enquired about exchange bonus for Alto." },
      { name: "Siddharth Patil", phone: "+91 97654 32109", email: "sidpatil@gmail.com", platform: "meta", campaign_id: campWeekendId, status: "lost", notes: "Not interested anymore. Already bought another car." },
      { name: "Amit Yadav", phone: "+91 95456 78901", email: "amit.yadav@rediffmail.com", platform: "google", campaign_id: campDiwaliId, status: "qualified", notes: "Looking for Baleno exchange." },
      { name: "Sneha Gokhale", phone: "+91 94220 54321", email: "sneha_g@outlook.com", platform: "meta", campaign_id: campWeekendId, status: "new", notes: "Brezza ZXI test drive." }
    ]

    for (let i = 0; i < mockLeads.length; i++) {
      const lead = mockLeads[i]
      await pool.query(
        `INSERT INTO leads (dealership_id, campaign_id, platform, platform_lead_id, name, phone, email, status, notes, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '${i * 2} days')`,
        [MOCK_DEALERSHIP_ID, lead.campaign_id, lead.platform, `mock_lead_${i}_${Date.now()}`, lead.name, lead.phone, lead.email, lead.status, lead.notes]
      )
    }
  }

  // 6. Ensure Metrics Cache history exists (last 30 days)
  const metricsCount = await pool.query("SELECT COUNT(*) FROM metrics_cache WHERE dealership_id = $1", [MOCK_DEALERSHIP_ID])
  if (parseInt(metricsCount.rows[0].count, 10) === 0) {
    console.log("Generating 30 days of metrics history...")
    const platforms = ["google", "meta"]
    
    // We generate daily data for the past 30 days
    for (let i = 30; i >= 0; i--) {
      for (const platform of platforms) {
        // Daily variations
        const dateStr = `NOW() - INTERVAL '${i} days'`
        
        let baseSpend = platform === "google" ? 2500 : 1500
        let randomFactor = 0.7 + Math.random() * 0.6 // 0.7 to 1.3
        let spend = Math.round(baseSpend * randomFactor * 100) / 100
        let impressions = Math.round(spend * (platform === "google" ? 15 : 25))
        let clicks = Math.round(impressions * (platform === "google" ? 0.05 : 0.02))
        let leads = Math.round(clicks * (platform === "google" ? 0.12 : 0.18))
        if (leads === 0 && clicks > 0) leads = 1
        let cpl = leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0

        await pool.query(
          `INSERT INTO metrics_cache (dealership_id, platform, date, spend, impressions, clicks, leads, cpl)
           VALUES ($1, $2, CURRENT_DATE - ${i}, $3, $4, $5, $6, $7)
           ON CONFLICT (dealership_id, platform, date) DO NOTHING`,
          [MOCK_DEALERSHIP_ID, platform, spend, impressions, clicks, leads, cpl]
        )
      }
    }
  }

  // 7. Ensure Reports exist
  const reportCount = await pool.query("SELECT COUNT(*) FROM reports WHERE dealership_id = $1", [MOCK_DEALERSHIP_ID])
  if (parseInt(reportCount.rows[0].count, 10) === 0) {
    // Generate reports for past 3 weeks
    const reportData = [
      { start: 21, end: 15, spend: 28400.00, leads: 32, cpl: 887.50, insight: "Google search ads drove 60% of leads this week with a very low CPL of ₹750." },
      { start: 14, end: 8, spend: 32100.00, leads: 36, cpl: 891.66, insight: "Your Exchange Offer campaign delivered leads at ₹775 CPL — 12% better than average." },
      { start: 7, end: 1, spend: 34500.00, leads: 42, cpl: 821.42, insight: "Meta lead ads experienced high velocity with 24 new leads for Maruti Brezza." }
    ]

    for (let i = 0; i < reportData.length; i++) {
      const rep = reportData[i]
      await pool.query(
        `INSERT INTO reports (dealership_id, period_start, period_end, total_spend, total_leads, cpl, top_campaign_id, insight_text, pdf_url, sent_at)
         VALUES ($1, CURRENT_DATE - ${rep.start}, CURRENT_DATE - ${rep.end}, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${rep.end} days')`,
        [MOCK_DEALERSHIP_ID, rep.spend, rep.leads, rep.cpl, campDiwaliId, rep.insight, `https://supabase.co/storage/v1/object/public/reports/weekly-report-${i + 1}.pdf`]
      )
    }
  }

  console.log("Database seeded successfully!")
}
