export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API request failed: ${response.status} ${body}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  dashboard: {
    metrics: () => fetcher("/api/dashboard/metrics"),
  },
}
