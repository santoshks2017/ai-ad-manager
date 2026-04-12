import express from "express"

const router = express.Router()

router.get("/me", (_req, res) => {
  res.json({ user: null, message: "Not implemented yet" })
})

export default router
