import express from "express";
import {
  createUser,
  createRole,
  deleteRole,
  deleteUser,
  getUserManagementData,
  getRoles,
  getRolePermissions,
  updateRolePermissions,
  updateRole,
  updateUser
} from "../controllers/userController.js";
import {
  authenticate,
  authorize,
  authorizePermission
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);
router.get("/roles", authorize("ADMIN", "SUPERADMIN"), getRoles);
router.post("/roles", authorize("ADMIN", "SUPERADMIN"), createRole);
router.put("/roles/:id", authorize("ADMIN", "SUPERADMIN"), updateRole);
router.delete("/roles/:id", authorize("ADMIN", "SUPERADMIN"), deleteRole);
router.get("/role-permissions", authorize("ADMIN", "SUPERADMIN"), getRolePermissions);
router.put("/role-permissions/:roleName", authorize("ADMIN", "SUPERADMIN"), updateRolePermissions);
router.get("/", authorizePermission("users", "read"), getUserManagementData);
router.post("/", authorizePermission("users", "create"), createUser);
router.put("/:id", authorizePermission("users", "update"), updateUser);
router.delete("/:id", authorizePermission("users", "delete"), deleteUser);

export default router;
