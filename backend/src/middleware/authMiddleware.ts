import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { pool } from "../db.js"

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name?: string
    role: string
    dealershipId?: string
  }
}

// Default mock values for Sandbox mode
export const MOCK_USER_ID = "11111111-1111-1111-1111-111111111111"
export const MOCK_DEALERSHIP_ID = "22222222-2222-2222-2222-222222222222"

export async function getOrCreateMockUser() {
  // Ensure default dealership exists
  const dealershipRes = await pool.query(
    "SELECT id FROM dealerships WHERE id = $1",
    [MOCK_DEALERSHIP_ID]
  )
  if (dealershipRes.rows.length === 0) {
    await pool.query(
      "INSERT INTO dealerships (id, name) VALUES ($1, $2)",
      [MOCK_DEALERSHIP_ID, "Pune Maruti Suzuki"]
    )
  }

  // Ensure default user exists
  const userRes = await pool.query(
    "SELECT id, dealership_id FROM users WHERE id = $1",
    [MOCK_USER_ID]
  )
  if (userRes.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (id, email, name, role, dealership_id) VALUES ($1, $2, $3, $4, $5)",
      [MOCK_USER_ID, "santosh@pune-maruti.com", "Santosh Sharma", "owner", MOCK_DEALERSHIP_ID]
    )
  }
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization
  const secret = process.env.NEXTAUTH_SECRET || "my-super-secret-nextauth-token-jwe-signing-key"

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (process.env.SANDBOX_MODE === "true") {
      // Automatic fallback in sandbox mode
      try {
        await getOrCreateMockUser()
        req.user = {
          id: MOCK_USER_ID,
          email: "santosh@pune-maruti.com",
          name: "Santosh Sharma",
          role: "owner",
          dealershipId: MOCK_DEALERSHIP_ID,
        }
        return next()
      } catch (err) {
        console.error("Error seeding default mock user in auth middleware:", err)
        return res.status(500).json({ error: "Auth setup error" })
      }
    }
    return res.status(401).json({ error: "Unauthorized: Missing auth token" })
  }

  const token = authHeader.split(" ")[1]

  try {
    const decoded = jwt.verify(token, secret) as any
    
    // Decoded token contains email, and we can fetch or insert user in DB
    const email = decoded.email
    if (!email) {
      return res.status(401).json({ error: "Unauthorized: Invalid token payload" })
    }

    // Lookup user in DB
    let userRes = await pool.query(
      "SELECT id, name, role, dealership_id FROM users WHERE email = $1",
      [email]
    )

    let user = userRes.rows[0]

    // If user signs in for the first time, auto-create a dealership and user record
    if (!user) {
      // Create dealership
      const dealershipName = `${decoded.name || "My"}'s Dealership`
      const dealerInsert = await pool.query(
        "INSERT INTO dealerships (name) VALUES ($1) RETURNING id",
        [dealershipName]
      )
      const dealershipId = dealerInsert.rows[0].id

      // Create user
      const userInsert = await pool.query(
        "INSERT INTO users (email, name, role, dealership_id) VALUES ($1, $2, $3, $4) RETURNING id, name, role, dealership_id",
        [email, decoded.name || email.split("@")[0], "owner", dealershipId]
      )
      user = userInsert.rows[0]
    }

    req.user = {
      id: user.id,
      email,
      name: user.name,
      role: user.role,
      dealershipId: user.dealership_id,
    }

    next()
  } catch (error) {
    console.error("JWT verification failed:", error)
    return res.status(401).json({ error: "Unauthorized: Invalid token" })
  }
}
