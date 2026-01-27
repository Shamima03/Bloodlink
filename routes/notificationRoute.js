import express from "express";
import auth from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import { User } from "../models/user.model.js";

const router = express.Router();

// GET all notifications for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ toUser: req.user.id })
      .sort({ createdAt: -1 })
      .populate("fromUser", "name"); // show sender's name

    res.json(notifications);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
