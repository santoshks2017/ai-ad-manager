import { testPool } from "./setup.js"

export async function clearTables() {
  await testPool.query(`
    TRUNCATE leads, metrics_cache, reports, budget_settings, campaigns, ad_accounts, users, dealerships CASCADE
  `)
}

export async function seedDealership(name = "Test Dealership") {
  const { rows } = await testPool.query(
    "INSERT INTO dealerships (name) VALUES ($1) RETURNING *",
    [name]
  )
  return rows[0]
}

export async function seedUser(dealershipId: string, email = "test@example.com") {
  const { rows } = await testPool.query(
    "INSERT INTO users (email, name, dealership_id, role) VALUES ($1, $2, $3, $4) RETURNING *",
    [email, "Test User", dealershipId, "owner"]
  )
  return rows[0]
}
