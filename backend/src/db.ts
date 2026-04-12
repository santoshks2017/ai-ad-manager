import type { Pool } from "pg"
import pkg from "pg"

const { Pool: PgPool } = pkg

export const pool: Pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
})
