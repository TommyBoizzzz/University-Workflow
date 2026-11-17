import { apiRequest } from "./apiClient.js";

export async function getAvailability(date) {
  return apiRequest(`/api/calendar/availability?${new URLSearchParams({ date })}`);
}

export async function getScheduleRecommendations(details) {
  return apiRequest("/api/calendar/recommendations", {
    method: "POST",
    body: JSON.stringify(details)
  });
}

export async function getCalendarEvents(from, to) {
  return apiRequest(`/api/calendar/events?${new URLSearchParams({ from, to })}`);
}
