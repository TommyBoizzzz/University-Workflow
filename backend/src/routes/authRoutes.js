import express from "express";

import {
  login,
  getMe
} from "../controllers/authController.js";

import {
  authenticate
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/login", (req, res) => {
  res.set("Allow", "POST");
  res.status(405).json({
    success: false,
    message: "Use POST /api/auth/login with an email and password"
  });
});

router.get("/me", authenticate, getMe);

export default router;