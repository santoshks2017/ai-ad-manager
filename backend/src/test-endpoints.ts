// Native fetch is available in Node.js v18+

const BASE_URL = "http://localhost:4000"

async function testRoute(name: string, path: string, options: any = {}) {
  console.log(`Testing ${name}...`)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed with status ${res.status}: ${text}`)
    }

    const data = await res.json()
    console.log(`✅ ${name} passed! Received:`, JSON.stringify(data).slice(0, 150) + "...\n")
    return data
  } catch (err: any) {
    console.error(`❌ ${name} failed:`, err.message, "\n")
    return null
  }
}

async function runTests() {
  console.log("=== RUNNING API INTEGRATION TESTS ===\n")

  // 1. Health Endpoint
  await testRoute("Health Check", "/api/health")

  // 2. Auth Endpoint (will default to mock user in Sandbox mode)
  await testRoute("Auth Profile", "/api/auth/me")

  // 3. Integrations List
  await testRoute("Connected Accounts", "/api/integrations/accounts")

  // 4. Integrations OAuth urls
  await testRoute("Google Ads Auth URL", "/api/integrations/google/auth-url")
  await testRoute("Meta Ads Auth URL", "/api/integrations/meta/auth-url")

  // 5. Dashboard Metrics
  await testRoute("Dashboard Metrics (7 days)", "/api/dashboard/metrics?period=week")

  // 6. Campaign Templates
  const templates = await testRoute("Campaign Templates List", "/api/campaigns/templates")

  // 7. Campaign Creation
  let newCampaignId = ""
  if (templates && templates.length > 0) {
    const createRes = await testRoute("Campaign Creation", "/api/campaigns/create", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Drive Brezza Weekend",
        templateType: "test_drive",
        carModel: "Maruti Brezza",
        offerText: "Book freeBreza test drive!",
        budget: 45000,
        startDate: "2026-05-24",
        endDate: "2026-06-07",
        targetLocation: "Pune",
        platforms: ["google", "meta"]
      })
    })
    if (createRes?.success) {
      newCampaignId = createRes.campaign.id
    }
  }

  // 8. Campaigns List
  await testRoute("Campaigns List", "/api/campaigns")

  // 9. Pause Campaign (if one was created)
  if (newCampaignId) {
    await testRoute("Pause Campaign", `/api/campaigns/${newCampaignId}/pause`, {
      method: "PATCH"
    })
  }

  // 10. Leads List
  await testRoute("Leads Inbox List", "/api/leads?status=new")

  // 11. Budget Settings
  await testRoute("Budget Settings", "/api/budget/settings")

  // 12. Reports History
  await testRoute("Reports Listing", "/api/reports")

  // 13. Reports Send Now Trigger
  await testRoute("Report Generation Trigger", "/api/reports/send-now", {
    method: "POST"
  })

  console.log("=== API INTEGRATION TESTS COMPLETE ===")
}

runTests()
