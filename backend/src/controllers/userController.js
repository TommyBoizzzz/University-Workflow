import bcrypt from "bcryptjs";
import pool from "../config/database.js";

const permissionResources = ["users", "requests", "approvals", "documents", "calendar"];
const permissionActions = ["read", "create", "update", "delete"];

const getManageableRoleNames = async (actorRole) => {
  const result = await pool.query(
    `SELECT role_name
     FROM roles
     WHERE ($1 = 'SUPERADMIN')
        OR ($1 = 'ADMIN' AND (is_system = FALSE OR role_name IN ('MANAGER', 'TEACHER')))
        OR ($1 IN ('MANAGER', 'TEACHER') AND role_name = 'TEACHER')
        OR ($1 NOT IN ('SUPERADMIN', 'ADMIN', 'MANAGER', 'TEACHER')
            AND is_system = FALSE AND role_name = $1)
     ORDER BY id`,
    [actorRole]
  );
  return result.rows.map((role) => role.role_name);
};

const canManageRole = async (actorRole, targetRole) => {
  if (actorRole === "SUPERADMIN") return true;
  const result = await pool.query(
    "SELECT role_name, is_system AS \"isSystem\" FROM roles WHERE role_name = $1",
    [targetRole]
  );
  if (result.rowCount === 0) return false;
  if (actorRole === "ADMIN") {
    return !result.rows[0].isSystem ||
      ["MANAGER", "TEACHER"].includes(result.rows[0].role_name);
  }
  if (!["MANAGER", "TEACHER"].includes(actorRole)) {
    return !result.rows[0].isSystem && result.rows[0].role_name === actorRole;
  }
  return ["MANAGER", "TEACHER"].includes(actorRole) &&
    result.rows[0].role_name === "TEACHER";
};

export const getUserManagementData = async (req, res) => {
  try {
    const rolesActorCanManage = await getManageableRoleNames(req.user.role);
    if (rolesActorCanManage.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission"
      });
    }

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
        WHERE roles.role_name = ANY($1)
        ORDER BY users.created_at DESC, users.id DESC`,
        [rolesActorCanManage]
      ),
      pool.query(
        `SELECT role_name AS name
         FROM roles
         WHERE role_name = ANY($1)
         ORDER BY id`,
        [rolesActorCanManage]
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

    const normalizedEmail = email.trim().toLowerCase();
    const [existingUser, roleResult] = await Promise.all([
      pool.query(
        "SELECT id FROM users WHERE LOWER(email) = $1",
        [normalizedEmail]
      ),
      pool.query(
        "SELECT id, is_system AS \"isSystem\" FROM roles WHERE role_name = $1",
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

    if (!(await canManageRole(req.user.role, role))) {
      return res.status(403).json({
        success: false,
        message: "You cannot create an account with that role"
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

export const updateUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID"
    });
  }

  const {
    fullName,
    email,
    password,
    role,
    departmentId = null,
    status
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

  if (typeof role !== "string") {
    return res.status(400).json({
      success: false,
      message: "Select a valid role"
    });
  }

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be ACTIVE or INACTIVE"
    });
  }

  if (Number(req.user.id) === userId && (status === "INACTIVE" || role !== req.user.role)) {
    return res.status(400).json({
      success: false,
      message: "You cannot deactivate your own account or change your own role"
    });
  }

  if (
    password !== undefined &&
    password !== "" &&
    (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72)
  ) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 12 characters and no more than 72 bytes"
    });
  }

  try {
    const currentUserResult = await pool.query(
      `SELECT roles.role_name AS role
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE users.id = $1`,
      [userId]
    );

    if (currentUserResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!(await canManageRole(req.user.role, currentUserResult.rows[0].role))) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage that account"
      });
    }

    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE role_name = $1",
      [role]
    );
    if (roleResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Select a valid role"
      });
    }

    if (!(await canManageRole(req.user.role, role))) {
      return res.status(403).json({
        success: false,
        message: "You cannot assign that role"
      });
    }

    let normalizedDepartmentId = null;
    if (departmentId !== null && departmentId !== "") {
      normalizedDepartmentId = Number(departmentId);
      if (!Number.isSafeInteger(normalizedDepartmentId) || normalizedDepartmentId < 1) {
        return res.status(400).json({
          success: false,
          message: "Select a valid department"
        });
      }

      const departmentResult = await pool.query(
        "SELECT id FROM departments WHERE id = $1",
        [normalizedDepartmentId]
      );
      if (departmentResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Select a valid department"
        });
      }
    }

    const values = [
      fullName.trim(),
      email.trim().toLowerCase(),
      roleResult.rows[0].id,
      normalizedDepartmentId,
      status,
      userId
    ];
    let passwordUpdate = "";
    if (password) {
      values.push(await bcrypt.hash(password, 12));
      passwordUpdate = `, password = $${values.length}`;
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           role_id = $3,
           department_id = $4,
           status = $5
           ${passwordUpdate}
       WHERE id = $6
       RETURNING id`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User updated successfully"
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update user"
    });
  }
};

export const deleteUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID"
    });
  }

  if (Number(req.user.id) === userId) {
    return res.status(400).json({
      success: false,
      message: "You cannot delete your own account"
    });
  }

  try {
    const targetResult = await pool.query(
      `SELECT roles.role_name AS role
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE users.id = $1`,
      [userId]
    );

    if (targetResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!(await canManageRole(req.user.role, targetResult.rows[0].role))) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage that account"
      });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "This account has workflow records and cannot be permanently deleted. Deactivate it instead."
      });
    }

    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete user"
    });
  }
};

export const getRolePermissions = async (req, res) => {
  if (!["ADMIN", "SUPERADMIN"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only administrators can manage role permissions"
    });
  }

  try {
    const allowedRoles = await getManageableRoleNames(req.user.role);
    const [rolesResult, permissionResult] = await Promise.all([
      pool.query(
        `SELECT id, role_name AS name, is_system AS "isSystem"
         FROM roles
         WHERE role_name = ANY($1)
         ORDER BY id`,
        [allowedRoles]
      ),
      pool.query(
        `SELECT roles.role_name AS role, role_permissions.resource,
                role_permissions.action, role_permissions.enabled
         FROM role_permissions
         JOIN roles ON roles.id = role_permissions.role_id
         WHERE roles.role_name = ANY($1)`,
        [allowedRoles]
      )
    ]);

    const roles = rolesResult.rows.map((role) => ({
      name: role.name,
      permissions: Object.fromEntries(permissionResources.map((resource) => [
        resource,
        Object.fromEntries(permissionActions.map((action) => [action, false]))
      ]))
    }));

    for (const permission of permissionResult.rows) {
      const role = roles.find((item) => item.name === permission.role);
      if (role) role.permissions[permission.resource][permission.action] = permission.enabled;
    }

    res.json({
      success: true,
      roles,
      resources: permissionResources,
      actions: permissionActions
    });
  } catch (error) {
    console.error("Load role permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load role permissions"
    });
  }
};

export const updateRolePermissions = async (req, res) => {
  const { roleName } = req.params;
  const permissions = req.body?.permissions;

  if (!["ADMIN", "SUPERADMIN"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You cannot manage permissions for that role"
    });
  }

  if (roleName === "SUPERADMIN") {
    return res.status(400).json({
      success: false,
      message: "Super Admin permissions are fixed"
    });
  }

  const hasValidShape = permissions &&
    typeof permissions === "object" &&
    permissionResources.every((resource) =>
      permissions[resource] &&
      permissionActions.every((action) => typeof permissions[resource][action] === "boolean")
    );
  if (!hasValidShape) {
    return res.status(400).json({
      success: false,
      message: "Provide a boolean value for every role permission"
    });
  }

  let client;
  try {
    if (!(await canManageRole(req.user.role, roleName))) {
      return res.status(403).json({
        success: false,
        message: "You cannot manage permissions for that role"
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    const roleResult = await client.query(
      "SELECT id FROM roles WHERE role_name = $1",
      [roleName]
    );
    if (roleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    for (const resource of permissionResources) {
      for (const action of permissionActions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, resource, action, enabled)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (role_id, resource, action)
           DO UPDATE SET enabled = EXCLUDED.enabled`,
          [roleResult.rows[0].id, resource, action, permissions[resource][action]]
        );
      }
    }
    await client.query("COMMIT");
    res.json({
      success: true,
      message: "Role permissions updated"
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Update role permissions rollback error:", rollbackError);
      }
    }
    console.error("Update role permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update role permissions"
    });
  } finally {
    if (client) client.release();
  }
};

export const getRoles = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT roles.id, roles.role_name AS name, roles.description,
              roles.is_system AS "isSystem", COUNT(users.id)::INTEGER AS "userCount"
       FROM roles
       LEFT JOIN users ON users.role_id = roles.id
       GROUP BY roles.id
       ORDER BY roles.is_system DESC, roles.role_name`
    );
    res.json({
      success: true,
      roles: result.rows
    });
  } catch (error) {
    console.error("Load roles error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load roles"
    });
  }
};

export const createRole = async (req, res) => {
  const { name, description = "" } = req.body ?? {};
  const normalizedName = typeof name === "string" ? name.trim().toUpperCase() : "";

  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(normalizedName)) {
    return res.status(400).json({
      success: false,
      message: "Role name must be 2-50 letters, numbers, or underscores and start with a letter"
    });
  }
  if (typeof description !== "string" || description.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: "Role description must be 500 characters or fewer"
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const roleResult = await client.query(
      `INSERT INTO roles (role_name, description, is_system)
       VALUES ($1, $2, FALSE)
       RETURNING id, role_name AS name, description, is_system AS "isSystem"`,
      [normalizedName, description.trim() || null]
    );
    const roleId = roleResult.rows[0].id;
    for (const resource of permissionResources) {
      for (const action of permissionActions) {
        await client.query(
          `INSERT INTO role_permissions (role_id, resource, action, enabled)
           VALUES ($1, $2, $3, FALSE)`,
          [roleId, resource, action]
        );
      }
    }
    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      role: { ...roleResult.rows[0], userCount: 0 }
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Create role rollback error:", rollbackError);
      }
    }
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A role with that name already exists"
      });
    }
    console.error("Create role error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to create role"
    });
  } finally {
    if (client) client.release();
  }
};

export const updateRole = async (req, res) => {
  const roleId = Number(req.params.id);
  const { name, description = "" } = req.body ?? {};
  const normalizedName = typeof name === "string" ? name.trim().toUpperCase() : "";
  if (!Number.isSafeInteger(roleId) || roleId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid role ID"
    });
  }
  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(normalizedName)) {
    return res.status(400).json({
      success: false,
      message: "Role name must be 2-50 letters, numbers, or underscores and start with a letter"
    });
  }
  if (typeof description !== "string" || description.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: "Role description must be 500 characters or fewer"
    });
  }

  try {
    const result = await pool.query(
      `UPDATE roles
       SET role_name = $1, description = $2
       WHERE id = $3 AND is_system = FALSE
       RETURNING id, role_name AS name, description, is_system AS "isSystem"`,
      [normalizedName, description.trim() || null, roleId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Custom role not found"
      });
    }
    res.json({
      success: true,
      role: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A role with that name already exists"
      });
    }
    console.error("Update role error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update role"
    });
  }
};

export const deleteRole = async (req, res) => {
  const roleId = Number(req.params.id);
  if (!Number.isSafeInteger(roleId) || roleId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid role ID"
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const roleResult = await client.query(
      "SELECT id, is_system AS \"isSystem\" FROM roles WHERE id = $1 FOR UPDATE",
      [roleId]
    );
    if (roleResult.rowCount === 0 || roleResult.rows[0].isSystem) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Custom role not found"
      });
    }

    await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);
    await client.query("DELETE FROM roles WHERE id = $1", [roleId]);
    await client.query("COMMIT");
    res.json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Delete role rollback error:", rollbackError);
      }
    }
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "This role has assigned users. Reassign them before deleting the role."
      });
    }
    console.error("Delete role error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete role"
    });
  } finally {
    if (client) client.release();
  }
};
