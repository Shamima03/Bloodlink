import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import { User } from "../models/user.model.js";

import fetch from "node-fetch"; 
// ----------------------------
// Create Blood Request
// ----------------------------
export const createRequest = async (req, res) => {
  try {
    const data = { ...req.body, user: req.user.id };
    const request = await BloodRequest.create(data);

    // 🔔 FIND USERS IN SAME CITY (case-insensitive) & exclude creator
    const users = await User.find({
      city: { $regex: new RegExp(`^${req.body.city}$`, "i") },
      _id: { $ne: req.user.id },
    });

    // 📩 Build push messages
    const messages = users
      .filter(user => user.pushToken)
      .map(user => ({
        to: user.pushToken,
        sound: "default",
        title: "🩸 Emergency Blood Needed!",
        body: `Urgent ${req.body.bloodGroup} blood required in ${req.body.city}. Can you help?`,
        data: { requestId: request._id },
      }));

    // 🚀 Send notifications in chunks (Expo limit safe)
    if (messages.length > 0) {
      const chunkSize = 100;

      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);

        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        const result = await response.json();
        console.log("📬 Expo Push Response:", JSON.stringify(result, null, 2));
      }
    }

    res.status(201).json({ message: "Request created", request });

  } catch (err) {
    console.error("❌ Create Request Error:", err);
    res.status(500).json({ error: err.message });
  }
};


// ----------------------------
// Get My Requests
// ----------------------------
export const getMyRequests = async (req, res) => {
    try {
        // const requests = await BloodRequest.find({ user: req.user.id });
        const requests = await BloodRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----------------------------
// Edit My Request
// ----------------------------
export const updateRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!request)
      return res.status(404).json({ message: "Request not found" });

    // ❌ BLOCK EDIT IF COMPLETED (except isCompleted itself)
    if (request.isCompleted && !("isCompleted" in req.body)) {
      return res
        .status(400)
        .json({ message: "Completed requests cannot be edited" });
    }

    Object.assign(request, req.body);
    await request.save();

    res.json({ message: "Request updated", request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ----------------------------
// Delete My Request
// ----------------------------
export const deleteRequest = async (req, res) => {
    try {
        const request = await BloodRequest.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!request)
            return res.status(404).json({ message: "Request not found or unauthorized" });

        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// ----------------------------
// Get All Other Users’ Requests
// ----------------------------
export const getOtherRequests = async (req, res) => {
    try {
        const requests = await BloodRequest.find({ 
            user: { $ne: req.user.id },  
            $or: [
                { isCompleted: false },           // incomplete requests
                { isCompleted: { $exists: false } } // old requests without the field
            ]
        }).populate("user", "name");

        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ----------------------------
// Click Interest Icon
// ----------------------------
export const markInterest = async (req, res) => {
    try {
        const request = await BloodRequest.findById(req.params.id);

        if (!request)
            return res.status(404).json({ message: "Request not found" });

        if (String(request.user) === req.user.id)
            return res.status(400).json({ message: "You cannot show interest on your own post" });

        if (request.interests.includes(req.user.id))
            return res.status(400).json({ message: "You already showed interest" });

        request.interests.push(req.user.id);
        await request.save();

        // Create Notification
        await Notification.create({
            toUser: request.user,
            fromUser: req.user.id,
            message: `Someone shared interest on your blood request.`
        });

        res.json({ message: "Interest added", request });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
