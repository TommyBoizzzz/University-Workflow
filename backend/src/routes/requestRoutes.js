import express from "express";
import {
  createAgenda,
  createRequest,
  deleteRequest,
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
router.post("/agenda", authorizePermission("requests", "create"), createAgenda);
router.post("/", authorizePermission("requests", "create"), createRequest);
router.delete("/:id", authorizePermission("requests", "read"), deleteRequest);
router.patch(
  "/:id/status",
  authorizePermission("requests", "update"),
  authorizePermission("approvals", "update"),
  authorizePermission("approvals", "create"),
  reviewRequest
);

export default router;
