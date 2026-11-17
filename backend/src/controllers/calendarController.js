import {
  getCalendarEvents,
  getBusyRanges
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
    const { ranges } = await getBusyRanges(date);
    return res.json({
      success: true,
      date,
      durationMinutes: 60,
      slots: isValidMeetingDate(date) ? getAvailableSlotStarts(ranges, date) : []
    });
  } catch (error) {
    console.error("Load meeting availability error:", error);
    return res.status(502).json({
      success: false,
      message: "Unable to load meeting availability"
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
        : "Unable to recommend a meeting time. Check Gemini configuration."
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
    return res.json({ success: true, ...calendar });
  } catch (error) {
    console.error("Load university calendar error:", error);
    return res.status(502).json({
      success: false,
      message: "Unable to load the university calendar"
    });
  }
};
