import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const registerUser = async (req, res) => {
  try {
    const { name, password, email, age, gender, bloodGroup, city, contact } =
      req.body;
    // Basic validation
    if (
      !name ||
      !email ||
      !password ||
      !age ||
      !gender ||
      !bloodGroup ||
      !city ||
      !contact
    ) {
      return res.status(400).json({ message: "All fields are important!" });
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
      loggedIn: false,
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(201).json({
      message: "Registered Successfully",
      Token: token,
      user: { user },
    });

    console.log("Registered Successfully")
  } catch (error) {
    console.error("", error);
    res
      .status(500)
      .json({ message: "internal server error", error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    const { email, password } = req.body || {};
    console.log("email", email);
    if (!email || !password)
      return res.status(400).json({ message: "Email and Password required" });

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token, user });

    console.log("Login successful")
  } catch (error) {
    console.log("Error", error);
    res.status(500).json({ message: "Internal Server error ", error });
    process.exit(1);
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

    const allowedUpdates = [
      "name",
      "age",
      "email",
      "gender",
      "city",
      "bloodGroup",
    ];
    const updates = {};

    // Only update allowed fields
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      decoded.id,
      updates,
      { new: true } // return updated document
    ).select("-password");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const users = await User.find({
      _id: { $ne: decoded.id }, // Exclude Logged-in User
    }).select("-password");

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Delete the logged-in user
    const deletedUser = await User.findByIdAndDelete(decoded.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User deleted successfully",
      userId: deletedUser._id,
    });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
export const savePushToken = async (req, res) => {
  try {
    const { expoPushToken, city } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      expoPushToken,
      city: city.trim().toLowerCase(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to save push token" });
  }
};

export {
  registerUser,
  loginUser,
  fetchLoginUser,
  updateUser,
  getAllUsers,
  deleteUser,
};
