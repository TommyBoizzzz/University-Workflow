import express from "express";
import {
  createDocumentBrief,
  listDocuments
} from "../controllers/documentController.js";
import { authenticate, authorizePermission } from "../middleware/authMiddleware.js";
import documentUpload from "../middleware/documentUpload.js";

const router = express.Router();

router.use(authenticate);
router.get("/", authorizePermission("documents", "read"), listDocuments);
router.post(
  "/brief",
  authorizePermission("documents", "create"),
  documentUpload,
  createDocumentBrief
);

export default router;
