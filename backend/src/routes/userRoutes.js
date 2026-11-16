import express from "express";
import {
  createUser,
  getUserManagementData
} from "../controllers/userController.js";
import {
  authenticate,
  authorize
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorize("ADMIN", "SUPERADMIN"));
router.get("/", getUserManagementData);
router.post("/", createUser);

export default router;
