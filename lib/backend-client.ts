/**
 * Backend API client — proxies Next.js API routes to the FastAPI backend.
 * Handles auth token fetching and request forwarding.
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

let cachedToken: string | null = null
let tokenExpiry = 0

/** Fetch a guest JWT from the backend (cached for 55 minutes). */
async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const res = await fetch(`${BACKEND_URL}/auth/token`)
  if (!res.ok) throw new Error('Failed to get auth token from backend')
  const data = await res.json()
  cachedToken = data.token as string
  tokenExpiry = Date.now() + 55 * 60 * 1000
  return cachedToken
}

/** GET request to backend (no auth). */
export async function backendGet(path: string) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend GET ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

/** Authenticated GET request to backend. */
export async function backendAuthGet(path: string) {
  const token = await getAuthToken()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend auth GET ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

/** Authenticated POST request to backend. */
export async function backendAuthPost(path: string, body: unknown) {
  const token = await getAuthToken()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend auth POST ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}

/** Authenticated PATCH request to backend. */
export async function backendAuthPatch(path: string, body: unknown) {
  const token = await getAuthToken()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend auth PATCH ${path} failed ${res.status}: ${text}`)
  }
  return res.json()
}
