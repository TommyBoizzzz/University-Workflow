
import pool from "../config/database.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const permissionResources = ["users", "requests", "approvals", "documents", "calendar"];
const permissionActions = ["read", "create", "update", "delete"];

const getPermissionsForRole = async (roleName) => {
  const permissions = Object.fromEntries(permissionResources.map((resource) => [
    resource,
    Object.fromEntries(permissionActions.map((action) => [action, false]))
  ]));
  const result = await pool.query(
    `SELECT role_permissions.resource, role_permissions.action, role_permissions.enabled
     FROM role_permissions
     JOIN roles ON roles.id = role_permissions.role_id
     WHERE roles.role_name = $1`,
    [roleName]
  );
  for (const permission of result.rows) {
    permissions[permission.resource][permission.action] = permission.enabled;
  }
  return permissions;
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("Login configuration error: JWT_SECRET is not set");
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured"
      });
    }

    // Find user and role
    const result = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.email,
        u.password,
        u.status,
        r.role_name,
        d.department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    // Check account status
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive"
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
      }
    );

    // Return safe user information
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role_name,
        department: user.department_name,
        permissions: await getPermissionsForRole(user.role_name)
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// GET CURRENT USER
export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.email,
        u.status,
        r.role_name,
        d.department_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const user = result.rows[0];

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive"
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role_name,
        department: user.department_name,
        permissions: await getPermissionsForRole(user.role_name)
      }
    });

  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
