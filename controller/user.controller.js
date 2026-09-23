import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import BloodRequest from "../models/BloodRequest.js";
import Notification from "../models/Notification.js";
const registerUser = async (req, res) => {
  try {
    const { name, password, email, age, gender, bloodGroup, city, contact, expoPushToken, termsAccepted } = req.body;
    
  if (!name || !email || !password || !age || !gender || !bloodGroup || !city || !contact) {
  return res.status(400).json({ message: "All fields are important!" });
}

if (Number(age) < 18 || Number(age) > 50) {
  return res.status(400).json({ message: "Age must be between 18 and 50" });
}

if (password.length < 6) {
  return res.status(400).json({ message: "Password must be at least 6 characters" });
}

if (name.trim().length < 1 || name.trim().length > 30) {
  return res.status(400).json({ message: "Name must be between 1 and 30 characters" });
}

if (!termsAccepted) {
  return res.status(400).json({ message: "You must accept the terms and conditions" });
}

    // Check if user exists already
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      age,
      gender,
      bloodGroup,
      city,
      contact,
      expoPushToken,
      termsAccepted: true,  // ✅ ADD THIS
      termsAcceptedAt: new Date(),  // ✅ ADD THIS
      loggedIn: false,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ message: "Registered Successfully", token, user: { user } });
    console.log("Registered Successfully");
  } catch (error) {
  if (error.name === "ValidationError") {
    const firstError = Object.values(error.errors)[0]?.message || "Invalid input";
    return res.status(400).json({ message: firstError });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(400).json({ message: `This ${field} is already registered` });
  }

  console.error("Register error:", error.message);
  res.status(500).json({ message: "Internal server error" });
}
};
const loginUser = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    const { email, password } = req.body || {};

    if (!email || !password)
      return res.status(400).json({ message: "Email and Password required" });

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    if (req.body.expoPushToken) {
      user.expoPushToken = req.body.expoPushToken;
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token, user });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Internal server error" }); // no raw error, no process.exit
  }
};

const fetchLoginUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by decoded.id
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Error fetching logged-in user:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const allowedUpdates = ["name", "age", "email", "gender", "city", "bloodGroup"];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      updates,
      { new: true, runValidators: true, context: "query" } // ← the key fix
    ).select("-password");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Update Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updatePushToken = async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) {
      return res.status(400).json({ message: "expoPushToken is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { expoPushToken },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ message: "Push token updated", user });
  } catch (error) {
    console.error("Push token update error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
const maskContact = (contact) => {
  if (!contact || contact.length < 10) return "Not available";
  return contact.slice(0, 2) + "XXXXXX" + contact.slice(-2);
};
const getAllUsers = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const users = await User.find({ _id: { $ne: decoded.id } })
      .select("-password -email -expoPushToken");

    const masked = users.map((u) => ({
      _id: u._id,
      name: u.name,
      city: u.city,
      bloodGroup: u.bloodGroup,
      contact: maskContact(u.contact),
    }));

    res.status(200).json({ message: "Users fetched successfully", users: masked });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const revealContact = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    jwt.verify(token, process.env.JWT_SECRET);

    const donor = await User.findById(req.params.id).select("contact");
    if (!donor) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ contact: donor.contact });
  } catch (error) {
    console.error("Reveal contact error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const deletedUser = await User.findByIdAndDelete(decoded.id);
    if (!deletedUser) return res.status(404).json({ message: "User not found" });

    await BloodRequest.deleteMany({ user: decoded.id });
    await Notification.deleteMany({
      $or: [{ toUser: decoded.id }, { fromUser: decoded.id }],
    });

    res.status(200).json({ message: "User and related data deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export {
  registerUser,
  loginUser,
  fetchLoginUser,
  updateUser,
  updatePushToken,
  getAllUsers,
  revealContact,
  deleteUser,
};
