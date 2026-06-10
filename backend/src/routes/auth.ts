import express from "express"
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware.js"

const router = express.Router()

router.get("/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user || null })
})

export default router
