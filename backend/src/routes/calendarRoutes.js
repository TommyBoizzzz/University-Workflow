import express from "express";
import {
  getAvailability,
  getEvents,
  getScheduleRecommendations,
  retryGoogleCalendarSync
} from "../controllers/calendarController.js";
import { authenticate, authorizePermission } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.get("/availability", authorizePermission("calendar", "read"), getAvailability);
router.post("/recommendations", authorizePermission("requests", "create"), getScheduleRecommendations);
router.get("/events", authorizePermission("calendar", "read"), getEvents);
router.post(
  "/meetings/:meetingId/sync",
  authorizePermission("calendar", "create"),
  retryGoogleCalendarSync
);

export default router;
