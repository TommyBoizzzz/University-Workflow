
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "university_workflow",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: process.env.VERCEL === "1" ? 2 : 10,
};

export const createDatabase = async () => {
  // Connect to PostgreSQL's default maintenance database
  const adminPool = new Pool({
    ...config,
    database: "postgres",
  });

  try {
    const dbName = config.database;

    // Validate database identifier
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
      throw new Error("Invalid database name");
    }

    const result = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );

    if (result.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created!`);
    } else {
      console.log(`Database '${dbName}' already exists!`);
    }
  } finally {
    await adminPool.end();
  }
};

const pool = new Pool(config);

export default pool;
