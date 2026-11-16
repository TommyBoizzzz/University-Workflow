
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    const bearerMatch = typeof authHeader === "string"
      ? authHeader.match(/^Bearer\s+(\S+)$/i)
      : null;

    if (!bearerMatch) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const decoded = jwt.verify(
      bearerMatch[1],
      process.env.JWT_SECRET
    );

    if (!decoded || typeof decoded !== "object" || !decoded.id || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    try {
      const result = await pool.query(
        `SELECT roles.role_name AS role
         FROM users
         JOIN roles ON roles.id = users.role_id
         WHERE users.id = $1 AND users.status = 'ACTIVE'`,
        [req.user.id]
      );
      if (result.rowCount === 0) {
        return res.status(401).json({
          success: false,
          message: "User account is unavailable"
        });
      }

      req.user.role = result.rows[0].role;
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission"
        });
      }

      next();
    } catch (error) {
      console.error("Role authorization error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to verify role"
      });
    }
  };
};

export const authorizePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT role_permissions.enabled, roles.role_name AS role
         FROM users
         JOIN roles ON roles.id = users.role_id
         JOIN role_permissions ON role_permissions.role_id = roles.id
         WHERE users.id = $1
           AND users.status = 'ACTIVE'
           AND role_permissions.resource = $2
           AND role_permissions.action = $3`,
        [req.user.id, resource, action]
      );

      if (result.rowCount === 0 || !result.rows[0].enabled) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission"
        });
      }

      req.user.role = result.rows[0].role;
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({
        success: false,
        message: "Unable to verify permission"
      });
    }
  };
};

export const requireSuperAdmin = authorize("SUPERADMIN");
