// bloodRequestController.js
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import { User } from "../models/user.model.js";
import { Expo } from "expo-server-sdk";

// ----------------------------
// Create Blood Request
// ----------------------------
export const createRequest = async (req, res) => {
  try {
    const { patientName, bloodGroup, hospital, location, units, contact, deadline } = req.body;

    if (!patientName || !bloodGroup || !hospital || !location || !units || !contact || !deadline) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 1️⃣ Save blood request
    const newRequest = await BloodRequest.create({
      patientName,
      bloodGroup,
      hospital,
      location,
      units,
      contact,
      deadline,
      user: req.user.id,
    });

    // 2️⃣ Find donors in the same city (excluding request creator)
    const donors = await User.find({
      city: location, 
      _id: { $ne: req.user.id },
      expoPushToken: { $ne: null },
    });

    if (donors.length > 0) {
      const expo = new Expo();
      const messages = [];

      for (const donor of donors) {
        if (!Expo.isExpoPushToken(donor.expoPushToken)) continue;

        messages.push({
          to: donor.expoPushToken,
          sound: "default",
          title: "🩸 Urgent Blood Needed",
          body: `${patientName} needs ${bloodGroup} blood at ${hospital}`,
          data: { screen: "Home", requestId: newRequest._id },
        });

        // Save notification in DB
        await Notification.create({
          toUser: donor._id,
          fromUser: req.user.id,
          message: `${patientName} needs ${bloodGroup} blood at ${hospital}`,
        });
      }

      // Send push notifications in chunks
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
        } catch (err) {
          console.error("Push notification error:", err);
        }
      }
    }

    // 3️⃣ Respond to client
    res.status(201).json({ message: "Blood request created", request: newRequest });
  } catch (err) {
    console.error("Create request error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------
// Get My Requests
// ----------------------------
export const getMyRequests = async (req, res) => {
  try {
    const requests = await BloodRequest.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ----------------------------
// Update My Request
// ----------------------------
export const updateRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findOne({ _id: req.params.id, user: req.user.id });
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Prevent editing if completed (except isCompleted itself)
    if (request.isCompleted && !("isCompleted" in req.body)) {
      return res.status(400).json({ message: "Completed requests cannot be edited" });
    }

    Object.assign(request, req.body);
    await request.save();

    res.json({ message: "Request updated", request });
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
    const request = await BloodRequest.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!request) return res.status(404).json({ message: "Request not found or unauthorized" });

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
    const requests = await BloodRequest.find({ user: { $ne: req.user.id } }).populate("user", "name");
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
