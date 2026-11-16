import express from "express";
import {
  createRequest,
  listRequests,
  reviewRequest
} from "../controllers/requestController.js";
import {
  authenticate,
  authorize
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.get("/", listRequests);
router.post("/", authorize("TEACHER"), createRequest);
router.patch(
  "/:id/status",
  authorize("MANAGER", "ADMIN", "SUPERADMIN"),
  reviewRequest
);

export default router;
