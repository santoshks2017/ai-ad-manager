import { afterAll, beforeAll } from "vitest"
import pkg from "pg"

const { Pool } = pkg

export const testPool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/ai_ad_manager_test",
})

beforeAll(async () => {
  const { readFileSync } = await import("fs")
  const { join, dirname } = await import("path")
  const { fileURLToPath } = await import("url")
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const sql = readFileSync(join(__dirname, "../db/schema.sql"), "utf-8")
  await testPool.query(sql)
})

afterAll(async () => {
  await testPool.end()
})
