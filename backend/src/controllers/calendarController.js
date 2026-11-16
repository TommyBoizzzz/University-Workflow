import pool from "../config/database.js";
import {
  getCalendarEvents,
  getBusyRanges,
  syncApprovedMeeting
} from "../services/calendarService.js";
import {
  getAvailableSlotStarts,
  isValidCalendarDate,
  isValidMeetingDate
} from "../utils/scheduling.js";
import { generateScheduleRecommendations } from "../integrations/gemini.js";

export const getAvailability = async (req, res) => {
  const { date } = req.query;
  if (!isValidCalendarDate(date)) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid calendar date"
    });
  }

  try {
    const { ranges, googleCalendarConfigured } = await getBusyRanges(date);
    return res.json({
      success: true,
      date,
      durationMinutes: 60,
      slots: isValidMeetingDate(date) ? getAvailableSlotStarts(ranges, date) : [],
      googleCalendarConfigured,
      warning: googleCalendarConfigured
        ? null
        : "Google Calendar is not configured. Availability currently includes only meetings in this app."
    });
  } catch (error) {
    console.error("Load meeting availability error:", error);
    return res.status(502).json({
      success: false,
      message: "Unable to verify university and Google Calendar availability"
    });
  }
};

export const getScheduleRecommendations = async (req, res) => {
  const { date, title, topic = "", description = "" } = req.body ?? {};
  if (!isValidMeetingDate(date)) {
    return res.status(400).json({
      success: false,
      message: "Choose a future weekday for the meeting"
    });
  }
  if (typeof title !== "string" || !title.trim() || title.trim().length > 255) {
    return res.status(400).json({
      success: false,
      message: "A meeting title is required to suggest times"
    });
  }
  if (
    typeof topic !== "string" || topic.length > 2000 ||
    typeof description !== "string" || description.length > 10000
  ) {
    return res.status(400).json({
      success: false,
      message: "Meeting details are invalid"
    });
  }

  try {
    const { ranges } = await getBusyRanges(date);
    const availableSlots = getAvailableSlotStarts(ranges, date);
    if (availableSlots.length === 0) {
      return res.status(409).json({
        success: false,
        message: "There are no available times on that date"
      });
    }
    const recommendations = await generateScheduleRecommendations({
      date,
      title: title.trim(),
      topic: topic.trim(),
      description: description.trim(),
      availableSlots
    });
    return res.json({ success: true, recommendations });
  } catch (error) {
    console.error("Recommend meeting schedule error:", error);
    return res.status(error.statusCode || 502).json({
      success: false,
      message: error.statusCode === 503
        ? error.message
        : "Unable to recommend a meeting time. Check Gemini and calendar configuration."
    });
  }
};

export const getEvents = async (req, res) => {
  const { from, to } = req.query;
  if (
    !isValidCalendarDate(from) ||
    !isValidCalendarDate(to) ||
    from > to ||
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 31
  ) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid date range of 32 days or fewer"
    });
  }

  try {
    const calendar = await getCalendarEvents(from, to);
    return res.json({
      success: true,
      ...calendar,
      warning: calendar.googleCalendarConfigured
        ? null
        : "Google Calendar is not configured. Showing meetings scheduled in this app."
    });
  } catch (error) {
    console.error("Load university calendar error:", error);
    return res.status(502).json({
      success: false,
      message: "Unable to load the university calendar"
    });
  }
};

export const retryGoogleCalendarSync = async (req, res) => {
  const meetingId = Number(req.params.meetingId);
  if (!Number.isSafeInteger(meetingId) || meetingId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid meeting ID"
    });
  }
  if (!process.env.GOOGLE_CALENDAR_ID ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return res.status(503).json({
      success: false,
      message: "Configure the shared Google Calendar integration before retrying sync"
    });
  }

  try {
    const result = await syncApprovedMeeting(meetingId);
    if (!result.synced) {
      return res.status(503).json({
        success: false,
        message: "Google Calendar is not configured"
      });
    }
    return res.json({
      success: true,
      message: "Meeting synced to Google Calendar"
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("Retry Google Calendar sync error:", error);
    try {
      await pool.query(
        `UPDATE meetings
         SET google_sync_status = 'FAILED', google_sync_error = $1
         WHERE id = $2`,
        ["Google Calendar sync failed", meetingId]
      );
    } catch (syncStateError) {
      console.error("Google Calendar sync state error:", syncStateError);
    }
    return res.status(502).json({
      success: false,
      message: "Unable to sync this meeting to Google Calendar"
    });
  }
};
