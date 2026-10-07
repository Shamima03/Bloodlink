import { Expo } from "expo-server-sdk";
import { pool } from "../config/db.js";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

// ---------- Helpers ----------

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseDeadline = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toBool = (v) => v === true || v === 1 || v === "1" || v === "true";

const REQUEST_COLUMNS = `r.id, r.user_id, r.patient_name, r.hospital, r.location,
  r.blood_group, r.units, r.contact, r.deadline, r.is_completed,
  r.created_at, r.updated_at`;

const formatRequest = (row, interests = []) => ({
  _id: row.id,
  id: row.id,
  user:
    row.user_name !== undefined
      ? { _id: row.user_id, id: row.user_id, name: row.user_name }
      : row.user_id,
  patientName: row.patient_name,
  hospital: row.hospital,
  location: row.location,
  bloodGroup: row.blood_group,
  units: row.units,
  contact: row.contact,
  deadline: row.deadline,
  isCompleted: !!row.is_completed,
  interests,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Loads the interested user ids for a list of requests -> Map(requestId -> [userIds])
const loadInterests = async (rows) => {
  const map = new Map();
  if (rows.length === 0) return map;

  const [list] = await pool.query(
    `SELECT blood_request_id, user_id
     FROM db_blood_request_interests
     WHERE blood_request_id IN (?)`,
    [rows.map((r) => r.id)],
  );

  for (const item of list) {
    if (!map.has(item.blood_request_id)) map.set(item.blood_request_id, []);
    map.get(item.blood_request_id).push(item.user_id);
  }
  return map;
};

// ----------------------------
// Create Blood Request
// ----------------------------
export const createRequest = async (req, res) => {
  console.log("🚀 createRequest called!");
  console.log("📦 Body received:", req.body);
  try {
    const {
      patientName,
      bloodGroup,
      hospital,
      location,
      units,
      contact,
      deadline,
    } = req.body;

    if (
      !patientName ||
      !bloodGroup ||
      !hospital ||
      !location ||
      !contact ||
      !deadline
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ message: "Invalid blood group" });
    }

    const unitCount = units === undefined || units === "" ? 1 : Number(units);
    if (!Number.isInteger(unitCount) || unitCount < 1) {
      return res.status(400).json({ message: "Units must be a whole number" });
    }

    const deadlineDate = parseDeadline(deadline);
    if (!deadlineDate) {
      return res.status(400).json({ message: "Invalid deadline" });
    }

    // 1️⃣ Save blood request
    const [result] = await pool.query(
      `INSERT INTO db_blood_requests
        (user_id, patient_name, hospital, location, blood_group, units, contact, deadline)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        req.user.id,
        patientName.trim(),
        hospital.trim(),
        location.trim(),
        bloodGroup,
        unitCount,
        String(contact).trim(),
        deadlineDate,
      ],
    );
    const requestId = result.insertId;

    const [created] = await pool.query(
      `SELECT ${REQUEST_COLUMNS} FROM db_blood_requests r WHERE r.id = ?`,
      [requestId],
    );
    const newRequest = formatRequest(created[0]);

    // 2️⃣ Find donors in the same city (excluding request creator)
    const [donors] = await pool.query(
      `SELECT id, expo_push_token
       FROM db_users
       WHERE LOWER(TRIM(city)) = LOWER(TRIM(?))
         AND id <> ?
         AND expo_push_token IS NOT NULL`,
      [location, req.user.id],
    );
    console.log("📍 Location searched:", location);
    console.log("🔔 Donors found:", donors.length);
    donors.forEach((d) => console.log("📱 Donor token:", d.expo_push_token));

    if (donors.length > 0) {
      const expo = new Expo();
      const messages = [];
      const notificationRows = [];
      const text = `${patientName} urgently needs ${bloodGroup} blood at ${hospital}. Donate or share with someone who can help!`;

      for (const donor of donors) {
        if (!Expo.isExpoPushToken(donor.expo_push_token)) continue;

        messages.push({
          to: donor.expo_push_token,
          sound: "default",
          title: "🩸 Urgent Blood Needed in Your City!",
          body: text,
          data: { screen: "Home", requestId },
        });

        notificationRows.push([donor.id, req.user.id, text]);
      }

      // Save all notifications in one query
      if (notificationRows.length > 0) {
        await pool.query(
          `INSERT INTO db_notifications (to_user_id, from_user_id, message) VALUES ?`,
          [notificationRows],
        );
      }

      for (const message of messages) {
        try {
          const tickets = await expo.sendPushNotificationsAsync([message]);
          console.log("📬 Push tickets:", JSON.stringify(tickets));
        } catch (err) {
          console.error(`Push notification error for ${message.to}:`, err);
        }
      }
    }

    // 3️⃣ Respond to client
    res
      .status(201)
      .json({ message: "Blood request created", request: newRequest });
  } catch (err) {
    console.error("Create request error:", err.code, err.sqlMessage || err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------
// Get My Requests
// ----------------------------
export const getMyRequests = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${REQUEST_COLUMNS}
       FROM db_blood_requests r
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id],
    );

    const interests = await loadInterests(rows);
    res.json(rows.map((r) => formatRequest(r, interests.get(r.id) || [])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------
// Update My Request
// ----------------------------
const UPDATE_FIELDS = {
  patientName: "patient_name",
  hospital: "hospital",
  location: "location",
  bloodGroup: "blood_group",
  units: "units",
  contact: "contact",
  deadline: "deadline",
  isCompleted: "is_completed",
};

export const updateRequest = async (req, res) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return res.status(400).json({ message: "Invalid request id" });

    const [existing] = await pool.query(
      `SELECT id, is_completed FROM db_blood_requests WHERE id = ? AND user_id = ? LIMIT 1`,
      [requestId, req.user.id],
    );
    if (existing.length === 0)
      return res.status(404).json({ message: "Request not found" });

    if (existing[0].is_completed && !("isCompleted" in req.body)) {
      return res
        .status(400)
        .json({ message: "Completed requests cannot be edited" });
    }

    const sets = [];
    const values = [];

    for (const [field, column] of Object.entries(UPDATE_FIELDS)) {
      let value = req.body[field];
      if (value === undefined) continue;

      if (field === "bloodGroup" && !BLOOD_GROUPS.includes(value)) {
        return res.status(400).json({ message: "Invalid blood group" });
      }
      if (field === "units") {
        value = Number(value);
        if (!Number.isInteger(value) || value < 1) {
          return res.status(400).json({ message: "Units must be a whole number" });
        }
      }
      if (field === "deadline") {
        value = parseDeadline(value);
        if (!value) return res.status(400).json({ message: "Invalid deadline" });
      }
      if (field === "isCompleted") value = toBool(value) ? 1 : 0;
      if (["patientName", "hospital", "location", "contact"].includes(field)) {
        value = String(value).trim();
        if (!value) {
          return res.status(400).json({ message: `${field} cannot be empty` });
        }
      }

      sets.push(`${column} = ?`);
      values.push(value);
    }

    if (sets.length > 0) {
      await pool.query(
        `UPDATE db_blood_requests SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
        [...values, requestId, req.user.id],
      );
    }

    const [rows] = await pool.query(
      `SELECT ${REQUEST_COLUMNS} FROM db_blood_requests r WHERE r.id = ?`,
      [requestId],
    );
    const interests = await loadInterests(rows);

    res.json({
      message: "Request updated",
      request: formatRequest(rows[0], interests.get(rows[0].id) || []),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------
// Delete My Request
// ----------------------------
export const deleteRequest = async (req, res) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return res.status(400).json({ message: "Invalid request id" });

    const [result] = await pool.query(
      `DELETE FROM db_blood_requests WHERE id = ? AND user_id = ?`,
      [requestId, req.user.id],
    );
    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Request not found or unauthorized" });

    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------
// Get Other Users’ Requests
// ----------------------------
export const getOtherRequests = async (req, res) => {
  try {
    // Requests whose deadline is today or later
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [rows] = await pool.query(
      `SELECT ${REQUEST_COLUMNS}, u.name AS user_name
       FROM db_blood_requests r
       JOIN db_users u ON u.id = r.user_id
       WHERE r.user_id <> ?
         AND r.is_completed = 0
         AND r.deadline >= ?
       ORDER BY r.created_at DESC`,
      [req.user.id, startOfToday],
    );

    const interests = await loadInterests(rows);
    res.json(rows.map((r) => formatRequest(r, interests.get(r.id) || [])));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};