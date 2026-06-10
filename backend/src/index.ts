import "./load-env.js"
import app from "./app.js"
import { seedDatabase } from "./db/seed.js"
import { startMetricsSyncSimulator } from "./cron/sync-metrics.js"

const port = Number(process.env.PORT ?? 4000)

async function startServer() {
  try {
    if (process.env.SANDBOX_MODE === "true") {
      await seedDatabase()
      startMetricsSyncSimulator()
    }
  } catch (err) {
    console.error("Database seeding failed:", err)
  }

  // Only call app.listen if we are not running in a Vercel serverless environment
  if (process.env.VERCEL !== "1") {
    app.listen(port, () => {
      console.log(`Backend server listening on http://localhost:${port}`)
    })
  }
}

startServer()

export default app

