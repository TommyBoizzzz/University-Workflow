import express from "express";
import {
  createRequest,
  listRequests,
  reviewRequest
} from "../controllers/requestController.js";
import {
  authenticate,
  authorizePermission
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.get("/", authorizePermission("requests", "read"), listRequests);
router.post("/", authorizePermission("requests", "create"), createRequest);
router.patch(
  "/:id/status",
  authorizePermission("requests", "update"),
  authorizePermission("approvals", "update"),
  authorizePermission("approvals", "create"),
  reviewRequest
);

export default router;
