import pool from "../config/database.js";

const requestSelection = `
  SELECT
    requests.id,
    requests.request_type AS type,
    requests.title,
    requests.topic,
    requests.description,
    requests.status,
    requests.created_at AS "createdAt",
    requests.teacher_id AS "teacherId",
    users.full_name AS "submittedBy",
    departments.department_name AS department
  FROM requests
  JOIN users ON users.id = requests.teacher_id
  LEFT JOIN departments ON departments.id = users.department_id
`;

export const listRequests = async (req, res) => {
  try {
    const isTeacher = req.user.role === "TEACHER";
    const result = await pool.query(
      `${requestSelection}
       ${isTeacher ? "WHERE requests.teacher_id = $1" : ""}
       ORDER BY requests.created_at DESC, requests.id DESC`,
      isTeacher ? [req.user.id] : []
    );

    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error("List requests error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to load requests"
    });
  }
};

export const createRequest = async (req, res) => {
  try {
    const { type, title, topic = null, description = null } = req.body ?? {};

    if (!["MEETING", "DOCUMENT"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Request type must be MEETING or DOCUMENT"
      });
    }

    if (typeof title !== "string" || !title.trim() || title.trim().length > 255) {
      return res.status(400).json({
        success: false,
        message: "A title of 1 to 255 characters is required"
      });
    }

    if (topic !== null && typeof topic !== "string") {
      return res.status(400).json({
        success: false,
        message: "Topic must be text"
      });
    }

    if (description !== null && typeof description !== "string") {
      return res.status(400).json({
        success: false,
        message: "Description must be text"
      });
    }

    const result = await pool.query(
      `INSERT INTO requests (teacher_id, request_type, title, topic, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, request_type AS type, title, topic, description, status,
                 created_at AS "createdAt"`,
      [
        req.user.id,
        type,
        title.trim(),
        topic?.trim() || null,
        description?.trim() || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Request submitted",
      request: result.rows[0]
    });
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to submit request"
    });
  }
};

export const reviewRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  const { status, remarks = null } = req.body ?? {};

  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID"
    });
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be APPROVED or REJECTED"
    });
  }

  if (remarks !== null && typeof remarks !== "string") {
    return res.status(400).json({
      success: false,
      message: "Remarks must be text"
    });
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const requestResult = await client.query(
      "SELECT id, status FROM requests WHERE id = $1 FOR UPDATE",
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    if (requestResult.rows[0].status !== "PENDING") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: "Only pending requests can be reviewed"
      });
    }

    await client.query(
      "UPDATE requests SET status = $1 WHERE id = $2",
      [status, requestId]
    );
    await client.query(
      `INSERT INTO approvals (request_id, approver_id, status, remarks)
       VALUES ($1, $2, $3, $4)`,
      [requestId, req.user.id, status, remarks?.trim() || null]
    );
    await client.query("COMMIT");
    transactionStarted = false;

    res.json({
      success: true,
      message: `Request ${status.toLowerCase()}`,
      requestId,
      status
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Request review rollback error:", rollbackError);
      }
    }

    console.error("Review request error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to review request"
    });
  } finally {
    client.release();
  }
};
