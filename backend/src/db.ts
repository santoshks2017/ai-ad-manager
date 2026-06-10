import type { Pool } from "pg"
import pkg from "pg"

const { Pool: PgPool } = pkg

console.log("DATABASE_URL at load time in db.ts:", process.env.DATABASE_URL)

export const pool: Pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
})
