import bcrypt from "bcryptjs";
import pool from "../config/database.js";

export const getUserManagementData = async (req, res) => {
  try {
    const isAdmin = req.user.role === "ADMIN";
    const [usersResult, rolesResult, departmentsResult] = await Promise.all([
      pool.query(
        `SELECT
          users.id,
          users.full_name AS "fullName",
          users.email,
          roles.role_name AS role,
          departments.department_name AS department,
          users.status,
          users.created_at AS "createdAt"
        FROM users
        JOIN roles ON roles.id = users.role_id
        LEFT JOIN departments ON departments.id = users.department_id
        ${isAdmin ? "WHERE roles.role_name <> 'SUPERADMIN'" : ""}
        ORDER BY users.created_at DESC, users.id DESC`
      ),
      pool.query(
        `SELECT role_name AS name
         FROM roles
         ${isAdmin ? "WHERE role_name IN ('MANAGER', 'TEACHER')" : ""}
         ORDER BY id`
      ),
      pool.query(
        `SELECT id, department_name AS name
         FROM departments
         ORDER BY department_name`
      )
    ]);

    res.json({
      success: true,
      users: usersResult.rows,
      roles: rolesResult.rows,
      departments: departmentsResult.rows
    });
  } catch (error) {
    console.error("Load user management data error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load user management data"
    });
  }
};

export const createUser = async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      departmentId = null
    } = req.body ?? {};

    if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: "A name of 1 to 150 characters is required"
      });
    }

    if (
      typeof email !== "string" ||
      email.trim().length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 12 characters and no more than 72 bytes"
      });
    }

    if (typeof role !== "string") {
      return res.status(400).json({
        success: false,
        message: "Select a valid role"
      });
    }

    if (
      req.user.role === "ADMIN" &&
      !["MANAGER", "TEACHER"].includes(role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Admins can create Manager and Teacher accounts only"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [existingUser, roleResult] = await Promise.all([
      pool.query(
        "SELECT id FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
      ),
      pool.query(
        "SELECT id FROM roles WHERE role_name = $1",
        [role]
      )
    ]);

    if (existingUser.rowCount > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    if (roleResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Select a valid role"
      });
    }

    let normalizedDepartmentId = null;
    let departmentName = null;
    if (departmentId !== null && departmentId !== "") {
      normalizedDepartmentId = Number(departmentId);
      if (!Number.isSafeInteger(normalizedDepartmentId) || normalizedDepartmentId < 1) {
        return res.status(400).json({
          success: false,
          message: "Select a valid department"
        });
      }

      const departmentResult = await pool.query(
        "SELECT id, department_name AS name FROM departments WHERE id = $1",
        [normalizedDepartmentId]
      );
      if (departmentResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Select a valid department"
        });
      }
      departmentName = departmentResult.rows[0].name;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role_id, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name AS "fullName", email, status,
                 created_at AS "createdAt"`,
      [
        fullName.trim(),
        normalizedEmail,
        hashedPassword,
        roleResult.rows[0].id,
        normalizedDepartmentId
      ]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        ...result.rows[0],
        role,
        department: departmentName
      }
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create user"
    });
  }
};
