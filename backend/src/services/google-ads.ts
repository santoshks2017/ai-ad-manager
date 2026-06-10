import { pool } from "../db.js"

export interface GoogleCampaignInput {
  name: string
  carModel: string
  offerText: string
  budget: number
  startDate: string
  endDate: string
  targetLocation: string
}

export class GoogleAdsService {
  private static isSandbox() {
    return process.env.SANDBOX_MODE === "true"
  }

  static async getAuthUrl(dealershipId: string): Promise<string> {
    if (this.isSandbox()) {
      const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
      return `${frontendUrl}/dashboard/settings?platform=google&oauth=success&state=${dealershipId}`
    }
    // Real implementation would use google-auth-library
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`
    const scope = "https://www.googleapis.com/auth/adwords"
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${dealershipId}&access_type=offline&prompt=consent`
  }

  static async exchangeCode(code: string, dealershipId: string) {
    if (this.isSandbox()) {
      const mockAccountId = "g_acc_9876543210"
      const mockAccountName = "Pune Maruti Google Ads"
      
      // Store in DB
      await pool.query(
        `INSERT INTO ad_accounts (dealership_id, platform, platform_account_id, account_name, access_token, refresh_token, token_expires_at)
         VALUES ($1, 'google', $2, $3, 'mock_google_access_token', 'mock_google_refresh_token', NOW() + INTERVAL '1 hour')
         ON CONFLICT (dealership_id, platform) 
         DO UPDATE SET platform_account_id = $2, account_name = $3, access_token = 'mock_google_access_token', refresh_token = 'mock_google_refresh_token', token_expires_at = NOW() + INTERVAL '1 hour'`,
        [dealershipId, mockAccountId, mockAccountName]
      )
      return { platformAccountId: mockAccountId, accountName: mockAccountName }
    }
    
    // Real OAuth exchange would go here
    throw new Error("Real Google Ads OAuth not configured yet.")
  }

  static async createCampaign(dealershipId: string, input: GoogleCampaignInput): Promise<string> {
    if (this.isSandbox()) {
      // Simulate API latency
      await new Promise((resolve) => setTimeout(resolve, 600))
      
      // Return a random Google Campaign ID
      const randomId = `g_camp_${Math.floor(100000000 + Math.random() * 900000000)}`
      return randomId
    }
    
    throw new Error("Real Google Ads campaign creation not configured.")
  }

  static async pauseCampaign(googleCampaignId: string): Promise<boolean> {
    if (this.isSandbox()) {
      return true;
    }
    throw new Error("Real Google Ads campaign pause not configured.")
  }

  static async resumeCampaign(googleCampaignId: string): Promise<boolean> {
    if (this.isSandbox()) {
      return true;
    }
    throw new Error("Real Google Ads campaign resume not configured.")
  }
}
