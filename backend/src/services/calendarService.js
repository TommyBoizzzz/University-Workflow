import pool from "../config/database.js";
import {
  createGoogleCalendarEvent,
  isGoogleCalendarConfigured,
  listGoogleCalendarEvents
} from "../integrations/googleCalendar.js";
import {
  getLocalDate,
  getMinutesInTimeZone,
  localDateTimeToDate,
  timeToMinutes,
  universityTimeZone
} from "../utils/scheduling.js";

const nextDate = (date) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

const eventRangeForDate = (event, date) => {
  if (event.start?.date && event.end?.date) {
    if (date < event.start.date || date >= event.end.date) return null;
    return { start: 0, end: 24 * 60, source: "google" };
  }

  if (!event.start?.dateTime || !event.end?.dateTime) return null;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;

  const startDate = getLocalDate(start);
  const endDate = getLocalDate(end);
  if (date < startDate || date > endDate) return null;
  return {
    start: startDate < date ? 0 : getMinutesInTimeZone(start),
    end: endDate > date ? 24 * 60 : getMinutesInTimeZone(end),
    source: "google"
  };
};

export async function getBusyRanges(date, { queryable = pool, excludeRequestId } = {}) {
  const result = await queryable.query(
    `SELECT requests.id AS "requestId", meetings.start_time AS "startTime",
            meetings.end_time AS "endTime"
     FROM meetings
     JOIN requests ON requests.id = meetings.request_id
     WHERE meetings.meeting_date = $1
       AND requests.status IN ('PENDING', 'APPROVED')`,
    [date]
  );
  const internalRanges = result.rows
    .filter((row) => Number(row.requestId) !== Number(excludeRequestId))
    .map((row) => ({
      start: timeToMinutes(row.startTime),
      end: timeToMinutes(row.endTime),
      source: "internal"
    }));

  if (!isGoogleCalendarConfigured()) {
    return { ranges: internalRanges, googleCalendarConfigured: false };
  }

  const timeMin = localDateTimeToDate(date, "00:00");
  const timeMax = localDateTimeToDate(nextDate(date), "00:00");
  const events = await listGoogleCalendarEvents(timeMin, timeMax);
  const googleRanges = events
    .map((event) => eventRangeForDate(event, date))
    .filter(Boolean);

  return {
    ranges: [...internalRanges, ...googleRanges],
    googleCalendarConfigured: true
  };
}

export async function getCalendarEvents(from, to) {
  const result = await pool.query(
    `SELECT meetings.id, requests.id AS "requestId", requests.title,
            requests.status, meetings.meeting_date AS date,
            meetings.start_time AS "startTime", meetings.end_time AS "endTime",
            meetings.google_event_id AS "googleEventId",
            meetings.google_sync_status AS "googleSyncStatus",
            users.full_name AS "submittedBy"
     FROM meetings
     JOIN requests ON requests.id = meetings.request_id
     JOIN users ON users.id = requests.teacher_id
     WHERE meetings.meeting_date BETWEEN $1 AND $2
       AND requests.status = 'APPROVED'
     ORDER BY meetings.meeting_date, meetings.start_time`,
    [from, to]
  );

  let googleEvents = [];
  let googleCalendarConfigured = isGoogleCalendarConfigured();
  if (googleCalendarConfigured) {
    const timeMin = localDateTimeToDate(from, "00:00");
    const timeMax = localDateTimeToDate(nextDate(to), "00:00");
    const events = await listGoogleCalendarEvents(timeMin, timeMax);
    const mirroredEventIds = new Set(
      result.rows.map((meeting) => meeting.googleEventId).filter(Boolean)
    );
    googleEvents = events.filter((event) => !mirroredEventIds.has(event.id)).map((event) => ({
      id: `google-${event.id}`,
      title: event.summary || "University calendar event",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      source: "Google Calendar",
      status: event.status
    }));
  }

  const internalEvents = result.rows.map((meeting) => ({
    ...meeting,
    start: localDateTimeToDate(meeting.date, meeting.startTime.slice(0, 5)).toISOString(),
    end: localDateTimeToDate(meeting.date, meeting.endTime.slice(0, 5)).toISOString(),
    source: "University Workflow"
  }));
  return {
    events: [...internalEvents, ...googleEvents],
    googleCalendarConfigured,
    timeZone: universityTimeZone()
  };
}

export async function syncApprovedMeeting(meetingId) {
  if (!isGoogleCalendarConfigured()) return { configured: false };
  const meetingResult = await pool.query(
    `SELECT requests.id AS "requestId", requests.title, requests.description, requests.status,
            meetings.meeting_date AS date, meetings.start_time AS "startTime",
            meetings.end_time AS "endTime", meetings.google_event_id AS "googleEventId"
     FROM meetings
     JOIN requests ON requests.id = meetings.request_id
     WHERE meetings.id = $1`,
    [meetingId]
  );
  if (meetingResult.rowCount === 0) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const meeting = meetingResult.rows[0];
  if (meeting.status !== "APPROVED") {
    const error = new Error("Only approved meetings can be added to Google Calendar");
    error.statusCode = 409;
    throw error;
  }
  if (meeting.googleEventId) return { configured: true, synced: true };

  const meetingDate = meeting.date instanceof Date
    ? meeting.date.toISOString().slice(0, 10)
    : String(meeting.date).slice(0, 10);
  const { ranges } = await getBusyRanges(meetingDate, {
    excludeRequestId: meeting.requestId
  });
  const meetingStart = timeToMinutes(meeting.startTime);
  const meetingEnd = timeToMinutes(meeting.endTime);
  if (ranges.some((range) => range.start < meetingEnd && range.end > meetingStart)) {
    const error = new Error("The time now conflicts with another calendar event");
    error.statusCode = 409;
    throw error;
  }

  const start = localDateTimeToDate(meeting.date, meeting.startTime.slice(0, 5));
  const end = localDateTimeToDate(meeting.date, meeting.endTime.slice(0, 5));
  const event = await createGoogleCalendarEvent({
    title: meeting.title,
    description: meeting.description || "",
    start,
    end,
    timeZone: universityTimeZone()
  });
  if (!event?.id) throw new Error("Google Calendar did not return an event ID");

  await pool.query(
    `UPDATE meetings
     SET google_event_id = $1, google_sync_status = 'SYNCED', google_sync_error = NULL
     WHERE id = $2`,
    [event.id, meetingId]
  );
  await pool.query(
    `INSERT INTO calendar_events (meeting_id, google_event_id, event_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (google_event_id) DO NOTHING`,
    [meetingId, event.id, event.url]
  );
  return { configured: true, synced: true };
}

export function getNextDate(date) {
  return nextDate(date);
}
