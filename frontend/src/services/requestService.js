import { apiRequest } from "./apiClient.js";

export async function getRequests() {
  const data = await apiRequest('/api/requests')
  return data.requests
}

export async function createRequest(requestData) {
  return apiRequest('/api/requests', {
    method: 'POST',
    body: JSON.stringify(requestData),
  })
}

export async function generateAgenda(meetingDetails) {
  return apiRequest('/api/requests/agenda', {
    method: 'POST',
    body: JSON.stringify(meetingDetails),
  })
}

export async function reviewRequest(requestId, status) {
  return apiRequest(`/api/requests/${requestId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
