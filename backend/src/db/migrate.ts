import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import pkg from "pg"

const { Pool } = pkg
const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf-8")
  await pool.query(sql)
  console.log("Migration complete")
  await pool.end()
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
