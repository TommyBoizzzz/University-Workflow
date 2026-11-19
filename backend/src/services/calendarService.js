import pool from "../config/database.js";
import {
  localDateTimeToDate,
  timeToMinutes,
  universityTimeZone
} from "../utils/scheduling.js";

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

  return { ranges: internalRanges };
}

export async function getCalendarEvents(from, to) {
  const result = await pool.query(
    `SELECT meetings.id, requests.id AS "requestId", requests.title,
            requests.status, meetings.meeting_date::text AS date,
            meetings.start_time AS "startTime", meetings.end_time AS "endTime",
            users.full_name AS "submittedBy"
     FROM meetings
     JOIN requests ON requests.id = meetings.request_id
     JOIN users ON users.id = requests.teacher_id
     WHERE meetings.meeting_date BETWEEN $1 AND $2
       AND requests.status = 'APPROVED'
     ORDER BY meetings.meeting_date, meetings.start_time`,
    [from, to]
  );

  const internalEvents = result.rows.map((meeting) => ({
    ...meeting,
    start: localDateTimeToDate(meeting.date, meeting.startTime.slice(0, 5)).toISOString(),
    end: localDateTimeToDate(meeting.date, meeting.endTime.slice(0, 5)).toISOString(),
    source: "University Workflow"
  }));
  return {
    events: internalEvents,
    timeZone: universityTimeZone()
  };
}
