
import jwt from "jsonwebtoken";

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
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission"
      });
    }

    next();
  };
};

export const requireSuperAdmin = authorize("SUPERADMIN");
