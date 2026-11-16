import { google } from "googleapis";

const scopes = ["https://www.googleapis.com/auth/calendar"];

export function isGoogleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

const getCalendar = () => {
  if (!isGoogleCalendarConfigured()) return null;

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes
  });
  return google.calendar({ version: "v3", auth });
};

export async function listGoogleCalendarEvents(timeMin, timeMax) {
  const calendar = getCalendar();
  if (!calendar) return null;

  const events = [];
  let pageToken;
  do {
    const result = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken
    });
    events.push(...(result.data.items || []));
    pageToken = result.data.nextPageToken;
  } while (pageToken);
  return events.filter((event) => event.status !== "cancelled");
}

export async function createGoogleCalendarEvent({ title, description, start, end, timeZone }) {
  const calendar = getCalendar();
  if (!calendar) return null;

  const result = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary: title,
      description,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone }
    }
  });
  return {
    id: result.data.id,
    url: result.data.htmlLink || null
  };
}
