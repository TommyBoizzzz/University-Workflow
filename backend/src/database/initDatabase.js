
import pool from "../config/database.js";
import bcrypt from "bcryptjs";

const permissionResources = ["users", "requests", "approvals", "documents", "calendar"];
const permissionActions = ["read", "create", "update", "delete"];
const defaultPermissions = {
  SUPERADMIN: Object.fromEntries(permissionResources.map((resource) => [
    resource,
    Object.fromEntries(permissionActions.map((action) => [action, true]))
  ])),
  ADMIN: {
    users: { read: true, create: true, update: true, delete: true },
    requests: { read: true, create: false, update: true, delete: false },
    approvals: { read: true, create: true, update: true, delete: false },
    documents: { read: true, create: false, update: false, delete: false },
    calendar: { read: true, create: false, update: false, delete: false }
  },
  MANAGER: {
    users: { read: false, create: false, update: false, delete: false },
    requests: { read: true, create: false, update: false, delete: false },
    approvals: { read: true, create: true, update: true, delete: false },
    documents: { read: true, create: false, update: false, delete: false },
    calendar: { read: true, create: false, update: false, delete: false }
  },
  TEACHER: {
    users: { read: false, create: false, update: false, delete: false },
    requests: { read: true, create: true, update: false, delete: false },
    approvals: { read: false, create: false, update: false, delete: false },
    documents: { read: true, create: false, update: false, delete: false },
    calendar: { read: true, create: false, update: false, delete: false }
  }
};

const initDatabase = async () => {
  console.log("Initializing university database...");

  // 1. Departments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      department_name VARCHAR(150) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Roles
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    ALTER TABLE roles
    ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id),
      resource VARCHAR(30) NOT NULL
        CHECK (resource IN ('users', 'requests', 'approvals', 'documents', 'calendar')),
      action VARCHAR(10) NOT NULL
        CHECK (action IN ('read', 'create', 'update', 'delete')),
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (role_id, resource, action)
    )
  `);

  // 3. Users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      department_id INTEGER REFERENCES departments(id),
      status VARCHAR(20) DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES users(id),
      request_type VARCHAR(30) NOT NULL
        CHECK (request_type IN ('MEETING', 'DOCUMENT')),
      title VARCHAR(255) NOT NULL,
      topic TEXT,
      description TEXT,
      status VARCHAR(30) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. Meetings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      request_id INTEGER UNIQUE REFERENCES requests(id),
      meeting_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      location VARCHAR(255),
      google_event_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 6. Agendas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agendas (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES requests(id),
      generated_content JSONB NOT NULL,
      edited_content JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Documents
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES requests(id),
      document_title VARCHAR(255) NOT NULL,
      google_doc_id VARCHAR(255),
      drive_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Approvals
  await pool.query(`
    CREATE TABLE IF NOT EXISTS approvals (
      id SERIAL PRIMARY KEY,
      request_id INTEGER REFERENCES requests(id),
      approver_id INTEGER REFERENCES users(id),
      status VARCHAR(30) NOT NULL,
      remarks TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 9. Calendar events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER REFERENCES meetings(id),
      google_event_id VARCHAR(255) UNIQUE,
      event_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("All database tables are ready!");

  // 10. Seed roles
  const roles = [
    ["SUPERADMIN", "Full system access"],
    ["ADMIN", "Manage university system"],
    ["MANAGER", "Review and approve requests"],
    ["TEACHER", "Submit requests and manage own documents"],
  ];

  for (const [name, description] of roles) {
    await pool.query(
      `INSERT INTO roles (role_name, description, is_system)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (role_name)
       DO UPDATE SET description = EXCLUDED.description, is_system = TRUE`,
      [name, description]
    );
  }

  console.log("Default roles created!");

  for (const [roleName, resources] of Object.entries(defaultPermissions)) {
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE role_name = $1",
      [roleName]
    );
    const roleId = roleResult.rows[0].id;

    for (const resource of permissionResources) {
      for (const action of permissionActions) {
        await pool.query(
          `INSERT INTO role_permissions (role_id, resource, action, enabled)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (role_id, resource, action) DO NOTHING`,
          [roleId, resource, action, resources[resource]?.[action] === true]
        );
      }
    }
  }

  // 11. Seed departments
  const departments = [
    "Information Technology",
    "Business Administration",
    "Accounting and Finance",
    "English",
    "Management",
  ];

  for (const name of departments) {
    await pool.query(
      `INSERT INTO departments (department_name)
       VALUES ($1)
       ON CONFLICT (department_name) DO NOTHING`,
      [name]
    );
  }

  // 12. Create Super Admin
  const adminName = process.env.SUPERADMIN_NAME;
  const adminEmail = process.env.SUPERADMIN_EMAIL;
  const adminPassword = process.env.SUPERADMIN_PASSWORD;

  if (!adminName || !adminEmail || !adminPassword) {
    throw new Error("Super Admin environment variables are missing!");
  }

  if (adminPassword.length < 12) {
    throw new Error("Super Admin password must be at least 12 characters!");
  }

  const roleResult = await pool.query(
    `SELECT id FROM roles WHERE role_name = 'SUPERADMIN'`
  );

  const adminRoleId = roleResult.rows[0].id;

  const existingAdmin = await pool.query(
    `SELECT id FROM users WHERE email = $1`,
    [adminEmail]
  );

  if (existingAdmin.rowCount === 0) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    await pool.query(
      `INSERT INTO users
        (full_name, email, password, role_id)
       VALUES ($1, $2, $3, $4)`,
      [adminName, adminEmail, hashedPassword, adminRoleId]
    );

    console.log("Super Admin account created!");
  } else {
    console.log("Super Admin account already exists!");
  }

  console.log("University database initialization completed!");
};

export default initDatabase;
