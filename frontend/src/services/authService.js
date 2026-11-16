const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const TOKEN_STORAGE_KEY = 'university-workflow-token'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  let data

  try {
    data = await response.json()
  } catch {
    throw new Error('The server returned an unreadable response. Please try again.')
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'The request could not be completed.')
  }

  return data
}

export async function loginUser(email, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
  return data.user
}

export async function getCurrentUser() {
  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  if (!token) throw new Error('No saved session was found.')

  const data = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data.user
}

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function signOut() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}
