import app from "../src/server.js";
import initDatabase from "../src/database/initDatabase.js";

let initialization;

const ensureDatabaseInitialized = () => {
  if (!initialization) {
    initialization = initDatabase().catch((error) => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
};

export default async function handler(req, res) {
  try {
    await ensureDatabaseInitialized();
    return app(req, res);
  } catch (error) {
    console.error("Serverless database initialization failed:", error);
    return res.status(500).json({
      success: false,
      message: "API initialization failed"
    });
  }
}
