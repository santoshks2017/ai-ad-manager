import { pool } from "../db.js"

export interface MetaCampaignInput {
  name: string
  carModel: string
  offerText: string
  budget: number
  startDate: string
  endDate: string
  targetLocation: string
}

export class MetaAdsService {
  private static isSandbox() {
    return process.env.SANDBOX_MODE === "true"
  }

  static async getAuthUrl(dealershipId: string): Promise<string> {
    if (this.isSandbox()) {
      const frontendUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
      return `${frontendUrl}/dashboard/settings?platform=meta&oauth=success&state=${dealershipId}`
    }
    
    const clientId = process.env.META_CLIENT_ID || "mock-meta-id"
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/meta/callback`
    const scope = "ads_management,ads_read"
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${dealershipId}`
  }

  static async exchangeCode(code: string, dealershipId: string) {
    if (this.isSandbox()) {
      const mockAccountId = "m_acc_4567890123"
      const mockAccountName = "Pune Maruti Meta Ads"
      
      // Store in DB
      await pool.query(
        `INSERT INTO ad_accounts (dealership_id, platform, platform_account_id, account_name, access_token, refresh_token, token_expires_at)
         VALUES ($1, 'meta', $2, $3, 'mock_meta_access_token', NULL, NULL)
         ON CONFLICT (dealership_id, platform) 
         DO UPDATE SET platform_account_id = $2, account_name = $3, access_token = 'mock_meta_access_token', refresh_token = NULL, token_expires_at = NULL`,
        [dealershipId, mockAccountId, mockAccountName]
      )
      return { platformAccountId: mockAccountId, accountName: mockAccountName }
    }
    
    // Real OAuth exchange would go here
    throw new Error("Real Meta OAuth not configured yet.")
  }

  static async createCampaign(dealershipId: string, input: MetaCampaignInput): Promise<string> {
    if (this.isSandbox()) {
      // Simulate API latency
      await new Promise((resolve) => setTimeout(resolve, 600))
      
      // Return a random Meta Campaign ID
      const randomId = `m_camp_${Math.floor(100000000 + Math.random() * 900000000)}`
      return randomId
    }
    
    throw new Error("Real Meta Ads campaign creation not configured.")
  }

  static async pauseCampaign(metaCampaignId: string): Promise<boolean> {
    if (this.isSandbox()) {
      return true;
    }
    throw new Error("Real Meta Ads campaign pause not configured.")
  }

  static async resumeCampaign(metaCampaignId: string): Promise<boolean> {
    if (this.isSandbox()) {
      return true;
    }
    throw new Error("Real Meta Ads campaign resume not configured.")
  }
}
