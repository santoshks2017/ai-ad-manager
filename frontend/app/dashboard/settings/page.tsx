"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { api } from "../../../lib/api"

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)

  const loadAccounts = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.integrations.accounts()
      setAccounts(data)
    } catch (err) {
      console.error(err)
      setError("Failed to load connected accounts. Ensure backend server is running.")
    } finally {
      setLoading(false)
    }
  }

  // Handle OAuth callback parameters in URL
  const handleOAuthCallback = async () => {
    const platform = searchParams.get("platform")
    const oauthStatus = searchParams.get("oauth")
    
    if (platform && oauthStatus === "success") {
      try {
        setConnectingPlatform(platform)
        // Simulate code exchange callback
        const mockCode = `mock_code_${Date.now()}`
        if (platform === "google") {
          await api.integrations.googleCallback(mockCode)
        } else if (platform === "meta") {
          await api.integrations.metaCallback(mockCode)
        }
        
        // Clean URL query parameters
        router.replace("/dashboard/settings")
        // Reload list
        await loadAccounts()
      } catch (err) {
        console.error("Failed to complete OAuth callback:", err)
        alert(`OAuth integration failed for ${platform}`)
      } finally {
        setConnectingPlatform(null)
      }
    } else {
      loadAccounts()
    }
  }

  useEffect(() => {
    handleOAuthCallback()
  }, [searchParams])

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform)
    try {
      let authUrlRes
      if (platform === "google") {
        authUrlRes = await api.integrations.googleAuthUrl()
      } else {
        authUrlRes = await api.integrations.metaAuthUrl()
      }
      
      // Redirect to OAuth provider (which redirects back to dashboard/settings)
      if (authUrlRes?.url) {
        window.location.href = authUrlRes.url
      }
    } catch (err) {
      console.error(err)
      alert(`Failed to fetch connection URL for ${platform}`)
      setConnectingPlatform(null)
    }
  }

  const handleDisconnect = async (platform: string) => {
    const confirm = window.confirm(`Are you sure you want to disconnect your ${platform === "google" ? "Google Ads" : "Meta Ads"} account?`)
    if (!confirm) return

    setLoading(true)
    try {
      await api.integrations.disconnect(platform)
      await loadAccounts()
    } catch (err) {
      console.error(err)
      alert(`Failed to disconnect ${platform} account.`)
    } finally {
      setLoading(false)
    }
  }

  const isConnected = (platform: string) => {
    return accounts.some(acc => acc.platform === platform)
  }

  const getAccountDetails = (platform: string) => {
    return accounts.find(acc => acc.platform === platform)
  }

  if (loading && accounts.length === 0 && !connectingPlatform) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#008075]" />
          <p className="text-xs font-semibold text-slate-500 font-sans">Loading settings configurations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#008075]">
            Settings Console
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            Connect Ad Accounts
          </h1>
          <p className="mt-1 text-slate-500 text-xs">
            Connect and manage Google Ads and Meta Marketing credentials to unlock automated metrics sync and lead form integrations.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {connectingPlatform && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#008075]" />
          <p className="text-xs font-bold text-slate-700">Completing security handshake with {connectingPlatform === "google" ? "Google Ads" : "Meta Ads"}...</p>
        </div>
      )}

      {/* Connection grid */}
      {!connectingPlatform && (
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              id: "google",
              name: "Google Ads",
              description: "Connect to import Search campaign spend, impressions, clicks, and pull Google Lead Forms.",
              icon: "🔍"
            },
            {
              id: "meta",
              name: "Meta Ads (Facebook & Instagram)",
              description: "Connect to aggregate Meta Feed spend, run instant forms, and sync Meta Lead Ads in real time.",
              icon: "📱"
            }
          ].map((platform) => {
            const connected = isConnected(platform.id)
            const details = getAccountDetails(platform.id)
            
            return (
              <div
                key={platform.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-5"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-start gap-3.5">
                    <span className="text-2xl bg-slate-50 h-10 w-10 rounded-xl flex items-center justify-center border border-slate-100">{platform.icon}</span>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{platform.name}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-semibold">{platform.description}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-150/70 flex items-center justify-between text-xs font-semibold">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Status:</span>
                    <span className={`ml-1.5 font-bold ${connected ? "text-emerald-700" : "text-amber-600"}`}>
                      {connected ? "Connected ✅" : "Not connected ⚠️"}
                    </span>
                    {connected && details && (
                      <p className="text-slate-700 font-bold mt-0.5 font-mono text-[10px]">{details.account_name}</p>
                    )}
                  </div>

                  <div>
                    {connected ? (
                      <button
                        onClick={() => handleDisconnect(platform.id)}
                        className="rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 px-3 py-1.5 text-xs font-bold shadow-xs transition"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform.id)}
                        className="rounded-lg bg-[#ff6f00] hover:bg-[#e65c00] text-white px-3 py-1.5 text-xs font-bold shadow-sm transition"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                  Permissions requested: Read campaign performance metrics, download lead form attachments, and update campaign lifecycle status (Pause/Resume).
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
