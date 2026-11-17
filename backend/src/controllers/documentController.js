import path from "node:path";
import pool from "../config/database.js";
import { generateDocumentBrief } from "../integrations/gemini.js";

const sanitizeFilename = (filename) => (
  path.basename(filename).replace(/[\u0000-\u001f]/g, "").slice(0, 255)
);

const isSupportedDocument = (file) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === ".pdf") {
    return file.mimetype === "application/pdf" &&
      file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (extension === ".docx") {
    return file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      file.buffer.subarray(0, 2).toString("ascii") === "PK";
  }
  return false;
};

const getGeminiErrorMessage = (error) => {
  const status = Number(error.status);
  if (status === 400) {
    return "Gemini rejected the document request. Check the document format and Gemini model configuration.";
  }
  if (status === 401 || status === 403) {
    return "Gemini rejected the API credentials or access. Check GEMINI_API_KEY and its API restrictions.";
  }
  if (status === 404) {
    return "The configured Gemini model was not found. Check GEMINI_MODEL.";
  }
  if (status === 429) {
    return "Gemini quota or rate limit exceeded. Check your Gemini API quota and try again later.";
  }
  if (status >= 500) {
    return "Gemini is temporarily unavailable. Try again later.";
  }
  return "Unable to create the document brief. Check Gemini configuration and backend logs.";
};

export const createDocumentBrief = async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      message: "Upload a PDF or Word (.docx) document"
    });
  }
  if (!isSupportedDocument(file)) {
    return res.status(400).json({
      success: false,
      message: "The uploaded file must be a valid PDF or Word (.docx) document"
    });
  }
  if (typeof req.body.topic !== "undefined" &&
      (typeof req.body.topic !== "string" || req.body.topic.length > 2000)) {
    return res.status(400).json({
      success: false,
      message: "Document context must be 2,000 characters or fewer"
    });
  }

  const sourceFilename = sanitizeFilename(file.originalname);
  let brief;
  try {
    brief = await generateDocumentBrief({
      ...file,
      originalname: sourceFilename,
      topic: req.body.topic?.trim() || ""
    });
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    if (error.message === "No readable text was found in the Word document.") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === "The document is too long to summarize.") {
      return res.status(413).json({ success: false, message: error.message });
    }
    console.error("Generate document brief error:", error);
    return res.status(502).json({
      success: false,
      message: getGeminiErrorMessage(error)
    });
  }

  try {
    const documentResult = await pool.query(
      `INSERT INTO documents (created_by, document_title, source_filename, generated_brief)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at AS "createdAt"`,
      [req.user.id, brief.title, sourceFilename, JSON.stringify(brief)]
    );
    return res.status(201).json({
      success: true,
      message: "Document brief created and saved",
      document: {
        ...documentResult.rows[0],
        requestId: null,
        status: "READY",
        title: brief.title,
        sourceFilename,
        brief
      }
    });
  } catch (error) {
    console.error("Save document brief error:", error);
    return res.status(500).json({
      success: false,
      message: "The brief was generated, but could not be saved."
    });
  }
};

export const listDocuments = async (req, res) => {
  try {
    const isTeacher = req.user.role === "TEACHER";
    const result = await pool.query(
      `SELECT documents.id, documents.document_title AS title,
              documents.source_filename AS "sourceFilename",
              documents.generated_brief AS brief,
              requests.id AS "requestId", requests.status,
              documents.created_at AS "createdAt"
       FROM documents
       LEFT JOIN requests ON requests.id = documents.request_id
       WHERE ($1::boolean = FALSE
         OR documents.created_by = $2
         OR requests.teacher_id = $2)
       ORDER BY documents.created_at DESC, documents.id DESC`,
      [isTeacher, req.user.id]
    );
    return res.json({
      success: true,
      documents: result.rows.map((document) => ({
        ...document,
        status: document.status || "READY"
      }))
    });
  } catch (error) {
    console.error("Load document briefs error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load document briefs"
    });
  }
};
