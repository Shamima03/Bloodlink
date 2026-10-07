import express from "express";
import auth from "../middleware/auth.js";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.to_user_id, n.from_user_id, n.message, n.is_read,
              n.created_at, n.updated_at, u.name AS from_user_name
       FROM db_notifications n
       LEFT JOIN db_users u ON u.id = n.from_user_id
       WHERE n.to_user_id = ?
       ORDER BY n.created_at DESC, n.id DESC`,
      [req.user.id],
    );

    // Same shape the app got from Mongoose (fromUser populated with name)
    const notifications = rows.map((n) => ({
      _id: n.id,
      id: n.id,
      toUser: n.to_user_id,
      fromUser: n.from_user_id
        ? { _id: n.from_user_id, id: n.from_user_id, name: n.from_user_name }
        : null,
      message: n.message,
      isRead: !!n.is_read,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));

    res.json(notifications);
  } catch (err) {
    console.error("Fetch notifications error:", err.code, err.sqlMessage || err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;