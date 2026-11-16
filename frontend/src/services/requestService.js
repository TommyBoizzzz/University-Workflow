import { getStoredToken } from './authService.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function request(path, options = {}) {
  const token = getStoredToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('The server returned an unreadable response.')
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'The request could not be completed.')
  }

  return data
}

export async function getRequests() {
  const data = await request('/api/requests')
  return data.requests
}

export async function createRequest(requestData) {
  return request('/api/requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  })
}

export async function reviewRequest(requestId, status) {
  return request(`/api/requests/${requestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
