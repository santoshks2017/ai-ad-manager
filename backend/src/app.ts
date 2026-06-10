import cors from "cors"
import express from "express"
import healthRouter from "./routes/health.js"
import authRouter from "./routes/auth.js"
import dashboardRouter from "./routes/dashboard.js"
import integrationsRouter from "./routes/integrations.js"
import campaignsRouter from "./routes/campaigns.js"
import leadsRouter from "./routes/leads.js"
import budgetRouter from "./routes/budget.js"
import reportsRouter from "./routes/reports.js"

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.use("/api/health", healthRouter)
app.use("/api/auth", authRouter)
app.use("/api/dashboard", dashboardRouter)
app.use("/api/integrations", integrationsRouter)
app.use("/api/campaigns", campaignsRouter)
app.use("/api/leads", leadsRouter)
app.use("/api/budget", budgetRouter)
app.use("/api/reports", reportsRouter)

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" })
})

export default app
