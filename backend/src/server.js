
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pool, { createDatabase } from "./config/database.js";
import initDatabase from "./database/initDatabase.js";
import authRoutes from "./routes/authRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "University Workflow Automation API is running!"
  });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.json({
      success: true,
      message: "Database connected successfully!",
      time: result.rows[0].current_time
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// Start application
const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required to start the authentication API");
    }

    // Create database if missing
    await createDatabase();

    // Create tables and default accounts
    await initDatabase();

    // Start Express only after initialization succeeds
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log("--------------------------------");
      console.log("University Workflow API Started");
      console.log(`Server: http://localhost:${PORT}`);
      console.log("--------------------------------");
    });

  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;
