// bloodRequestController.js
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
import { User } from "../models/user.model.js";
import { Expo } from "expo-server-sdk";

// Create a new blood request and notify users
export const createRequest = async (req, res) => {
  try {
    const { patientName, bloodGroup, hospital, location, units, contact, deadline } = req.body;

    // 1️⃣ Save blood request
    const newRequest = await BloodRequest.create({
      patientName,
      bloodGroup,
      hospital,
      location,
      units,
      contact,
      deadline,
      createdBy: req.user.id,
    });

    // 2️⃣ Find users in same location (excluding request creator)
    const usersToNotify = await User.find({
     city: { $regex: new RegExp(`^${req.body.location}$`, "i") }, 
      _id: { $ne: req.user.id },
      expoPushToken: { $exists: true },
    });

    if (usersToNotify.length > 0) {
      const expo = new Expo();
      const messages = [];

      for (let user of usersToNotify) {
        if (!Expo.isExpoPushToken(user.expoPushToken)) continue;

        messages.push({
          to: user.expoPushToken,
          sound: "default",
          title: "New Blood Request Nearby",
          body: `${patientName} needs ${bloodGroup} blood at ${hospital}`,
          data: { requestId: newRequest._id },
        });

        // Save notification in DB
        await Notification.create({
          toUser: user._id,
          fromUser: req.user.id,
          message: `${patientName} needs ${bloodGroup} blood at ${hospital}`,
        });
      }

      // Send push notifications
      const chunks = expo.chunkPushNotifications(messages);
      for (let chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
    }

    res.status(201).json(newRequest);
  } catch (err) {
    console.error("Create blood request error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch my requests
export const getMyRequests = async (req, res) => {
  try {
    const requests = await BloodRequest.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Fetch other requests (optional)
export const getOtherRequests = async (req, res) => {
  try {
    const requests = await BloodRequest.find({ createdBy: { $ne: req.user.id } }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update request
export const updateRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    Object.assign(request, req.body);
    await request.save();
    res.json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete request
export const deleteRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.createdBy.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    await request.remove();
    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
