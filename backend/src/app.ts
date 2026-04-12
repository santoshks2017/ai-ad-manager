import cors from "cors"
import express from "express"
import healthRouter from "./routes/health.js"
import authRouter from "./routes/auth.js"
import dashboardRouter from "./routes/dashboard.js"

const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

app.use("/api/health", healthRouter)
app.use("/api/auth", authRouter)
app.use("/api/dashboard", dashboardRouter)

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" })
})

export default app
