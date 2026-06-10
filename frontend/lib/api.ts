import { getSession } from "next-auth/react"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession()
  const token = session?.backendToken

  const headers = new Headers(init?.headers)
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  
  // Only set Content-Type to application/json if we are not uploading a file or sending custom forms
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API request failed: ${response.status} ${body}`)
  }

  // Handle file downloading or plain text responses
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("text/csv")) {
    return response.text() as unknown as T
  }

  return response.json() as Promise<T>
}

export const api = {
  auth: {
    me: () => fetcher<{ user: any }>("/api/auth/me"),
  },
  dashboard: {
    metrics: (period: string, start?: string, end?: string) => {
      let query = `?period=${period}`
      if (start) query += `&start=${start}`
      if (end) query += `&end=${end}`
      return fetcher<any>(`/api/dashboard/metrics${query}`)
    },
  },
  campaigns: {
    list: () => fetcher<any[]>("/api/campaigns"),
    templates: () => fetcher<any[]>("/api/campaigns/templates"),
    create: (data: any) => fetcher<{ success: boolean; campaign: any }>("/api/campaigns/create", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    pause: (id: string) => fetcher<{ success: boolean }>(`/api/campaigns/${id}/pause`, {
      method: "PATCH",
    }),
    resume: (id: string) => fetcher<{ success: boolean }>(`/api/campaigns/${id}/resume`, {
      method: "PATCH",
    }),
  },
  leads: {
    list: (params: {
      status?: string
      platform?: string
      campaignId?: string
      search?: string
      page?: number
    }) => {
      const q = new URLSearchParams()
      if (params.status) q.set("status", params.status)
      if (params.platform) q.set("platform", params.platform)
      if (params.campaignId) q.set("campaignId", params.campaignId)
      if (params.search) q.set("search", params.search)
      if (params.page) q.set("page", params.page.toString())
      return fetcher<{ leads: any[]; pagination: any }>(`/api/leads?${q.toString()}`)
    },
    update: (id: string, data: { status?: string; notes?: string }) => fetcher<{ success: boolean; lead: any }>(`/api/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    exportUrl: (params: { status?: string; platform?: string; campaignId?: string; search?: string }) => {
      const q = new URLSearchParams()
      if (params.status) q.set("status", params.status)
      if (params.platform) q.set("platform", params.platform)
      if (params.campaignId) q.set("campaignId", params.campaignId)
      if (params.search) q.set("search", params.search)
      return `${BASE_URL}/api/leads/export?${q.toString()}`
    }
  },
  budget: {
    settings: () => fetcher<any[]>("/api/budget/settings"),
    update: (data: any) => fetcher<{ success: boolean }>("/api/budget/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    pauseAll: () => fetcher<{ success: boolean; message: string }>("/api/budget/pause-all", {
      method: "POST",
    }),
  },
  reports: {
    list: () => fetcher<any[]>("/api/reports"),
    detail: (id: string) => fetcher<any>(`/api/reports/${id}`),
    sendNow: () => fetcher<{ success: boolean; message: string }>("/api/reports/send-now", {
      method: "POST",
    }),
  },
  integrations: {
    accounts: () => fetcher<any[]>("/api/integrations/accounts"),
    googleAuthUrl: () => fetcher<{ url: string }>("/api/integrations/google/auth-url"),
    metaAuthUrl: () => fetcher<{ url: string }>("/api/integrations/meta/auth-url"),
    googleCallback: (code: string) => fetcher<{ success: boolean; account: any }>("/api/integrations/google/callback", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
    metaCallback: (code: string) => fetcher<{ success: boolean; account: any }>("/api/integrations/meta/callback", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
    disconnect: (platform: string) => fetcher<{ success: boolean }>(`/api/integrations/${platform}`, {
      method: "DELETE",
    }),
  }
}
