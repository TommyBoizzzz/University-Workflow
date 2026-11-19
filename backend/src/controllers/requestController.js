import pool from "../config/database.js";
import { generateAgenda } from "../integrations/gemini.js";
import {
  getBusyRanges
} from "../services/calendarService.js";
import {
  isFutureMeetingStart,
  isValidTime,
  timeToMinutes
} from "../utils/scheduling.js";

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
    departments.department_name AS department,
    meetings.meeting_date::text AS "meetingDate",
    meetings.start_time AS "meetingStart",
    meetings.end_time AS "meetingEnd",
    agendas.generated_content AS agenda
  FROM requests
  JOIN users ON users.id = requests.teacher_id
  LEFT JOIN departments ON departments.id = users.department_id
  LEFT JOIN meetings ON meetings.request_id = requests.id
  LEFT JOIN LATERAL (
    SELECT generated_content
    FROM agendas
    WHERE agendas.request_id = requests.id
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ) agendas ON TRUE
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
  const { type, title, topic = null, description = null, meetingDate, meetingStart, agenda } = req.body ?? {};
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
  if (topic !== null && (typeof topic !== "string" || topic.length > 2000)) {
    return res.status(400).json({
      success: false,
      message: "Topic must be text of 2,000 characters or fewer"
    });
  }
  if (description !== null && (typeof description !== "string" || description.length > 10000)) {
    return res.status(400).json({
      success: false,
      message: "Details must be text of 10,000 characters or fewer"
    });
  }
  if (type === "MEETING" && (
    !isFutureMeetingStart(meetingDate, meetingStart) ||
    !isValidTime(meetingStart) ||
    timeToMinutes(meetingStart) < 9 * 60 ||
    timeToMinutes(meetingStart) > 16 * 60 ||
    ![0, 30].includes(timeToMinutes(meetingStart) % 60)
  )) {
    return res.status(400).json({
      success: false,
      message: "Choose an available weekday slot between 9:00 and 16:00"
    });
  }

  if (agenda !== undefined && (
    !agenda ||
    typeof agenda !== "object" ||
    !Array.isArray(agenda.items) ||
    agenda.items.length > 8
  )) {
    return res.status(400).json({
      success: false,
      message: "The generated agenda is invalid"
    });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    if (type === "MEETING") {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [meetingDate]);
      const { ranges } = await getBusyRanges(meetingDate, { queryable: client });
      const start = timeToMinutes(meetingStart);
      if (ranges.some((range) => range.start < start + 60 && range.end > start)) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: "That time is no longer available. Choose another slot."
        });
      }
    }

    const result = await client.query(
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
    const request = result.rows[0];
    if (type === "MEETING") {
      const startMinutes = timeToMinutes(meetingStart);
      const endMinutes = startMinutes + 60;
      const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
      const meetingResult = await client.query(
        `INSERT INTO meetings (request_id, meeting_date, start_time, end_time, duration_minutes)
         VALUES ($1, $2, $3, $4, 60)
         RETURNING id`,
        [request.id, meetingDate, meetingStart, endTime]
      );
      request.meetingDate = meetingDate;
      request.meetingStart = meetingStart;
      request.meetingEnd = endTime;
      request.meetingId = meetingResult.rows[0].id;
      if (agenda !== undefined) {
        await client.query(
          "INSERT INTO agendas (request_id, generated_content) VALUES ($1, $2)",
          [request.id, JSON.stringify(agenda)]
        );
        request.agenda = agenda;
      }
    }
    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      success: true,
      message: "Request submitted",
      request
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Create request rollback error:", rollbackError);
      }
    }
    console.error("Create request error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit request"
    });
  } finally {
    if (client) client.release();
  }
};

export const deleteRequest = async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isSafeInteger(requestId) || requestId < 1) {
    return res.status(400).json({
      success: false,
      message: "Invalid request ID"
    });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `SELECT id, teacher_id AS "teacherId", status
       FROM requests
       WHERE id = $1
       FOR UPDATE`,
      [requestId]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    const request = result.rows[0];
    if (Number(request.teacherId) !== Number(req.user.id) && req.user.role !== "SUPERADMIN") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(403).json({
        success: false,
        message: "Only the request owner or a superadmin can delete this request"
      });
    }
    if (request.status !== "PENDING") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: "Only pending requests can be deleted"
      });
    }

    await client.query(
      `DELETE FROM calendar_events
       WHERE meeting_id IN (SELECT id FROM meetings WHERE request_id = $1)`,
      [requestId]
    );
    await client.query("DELETE FROM documents WHERE request_id = $1", [requestId]);
    await client.query("DELETE FROM approvals WHERE request_id = $1", [requestId]);
    await client.query("DELETE FROM agendas WHERE request_id = $1", [requestId]);
    await client.query("DELETE FROM meetings WHERE request_id = $1", [requestId]);
    await client.query("DELETE FROM requests WHERE id = $1", [requestId]);
    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      success: true,
      message: "Request deleted"
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Delete request rollback error:", rollbackError);
      }
    }
    console.error("Delete request error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete request"
    });
  } finally {
    if (client) client.release();
  }
};

export const createAgenda = async (req, res) => {
  const { title, topic = "", description = "" } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || title.trim().length > 255) {
    return res.status(400).json({
      success: false,
      message: "A meeting title is required to generate an agenda"
    });
  }
  if (
    typeof topic !== "string" || topic.length > 2000 ||
    typeof description !== "string" || description.length > 10000
  ) {
    return res.status(400).json({
      success: false,
      message: "Meeting details are invalid"
    });
  }

  try {
    const agenda = await generateAgenda({
      title: title.trim(),
      topic: topic.trim(),
      description: description.trim()
    });
    return res.json({ success: true, agenda });
  } catch (error) {
    console.error("Generate agenda error:", error);
    const geminiStatus = Number(error.status);
    let message = "Unable to generate an agenda. Check backend logs.";
    if (error.statusCode === 503) {
      message = error.message;
    } else if (geminiStatus === 400) {
      message = "Gemini rejected the agenda request. Check the model and request configuration.";
    } else if (geminiStatus === 401 || geminiStatus === 403) {
      message = "Gemini rejected the API credentials or access. Check GEMINI_API_KEY and its API restrictions.";
    } else if (geminiStatus === 404) {
      message = "The configured Gemini model was not found. Check GEMINI_MODEL.";
    } else if (geminiStatus === 429) {
      message = "Gemini quota or rate limit exceeded. Check your API quota and try again later.";
    } else if (geminiStatus >= 500) {
      message = "Gemini is temporarily unavailable. Try again later.";
    }
    return res.status(error.statusCode || 502).json({
      success: false,
      message
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

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const requestResult = await client.query(
      `SELECT requests.id, requests.status, requests.request_type AS type,
              requests.title, requests.description, meetings.id AS "meetingId",
              meetings.meeting_date::text AS "meetingDate", meetings.start_time AS "meetingStart",
              meetings.end_time AS "meetingEnd"
       FROM requests
       LEFT JOIN meetings ON meetings.request_id = requests.id
       WHERE requests.id = $1
       FOR UPDATE OF requests`,
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

    const request = requestResult.rows[0];
    if (status === "APPROVED" && request.type === "MEETING") {
      const permissionResult = await client.query(
        `SELECT role_permissions.enabled
         FROM users
         JOIN role_permissions ON role_permissions.role_id = users.role_id
         WHERE users.id = $1 AND role_permissions.resource = 'calendar'
           AND role_permissions.action = 'create'`,
        [req.user.id]
      );
      if (!permissionResult.rows[0]?.enabled) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(403).json({
          success: false,
          message: "Calendar: Create permission is required to approve a meeting"
        });
      }
      if (!request.meetingId) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: "This meeting request has no reserved time. Ask the teacher to submit it again."
        });
      }

      const meetingDate = request.meetingDate instanceof Date
        ? request.meetingDate.toISOString().slice(0, 10)
        : String(request.meetingDate).slice(0, 10);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [meetingDate]);
      const { ranges } = await getBusyRanges(meetingDate, {
        queryable: client,
        excludeRequestId: requestId
      });
      const meetingStart = timeToMinutes(request.meetingStart);
      const meetingEnd = timeToMinutes(request.meetingEnd);
      if (ranges.some((range) => range.start < meetingEnd && range.end > meetingStart)) {
        await client.query("ROLLBACK");
        transactionStarted = false;
        return res.status(409).json({
          success: false,
          message: "The requested time now conflicts with another meeting in this system. Reject the request and ask the teacher to choose another time."
        });
      }
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

    return res.json({
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
    if (client) client.release();
  }
};
