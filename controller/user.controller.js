import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/db.js";
import sendEmail from "../utils/sendEmail.js";

const GENDERS = ["Male", "Female", "Other"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

// ---------- Helpers ----------

const formatUser = (row) =>
  row && {
    _id: row.id, 
    id: row.id,
    name: row.name,
    email: row.email,
    contact: row.contact,
    age: row.age,
    gender: row.gender,
    bloodGroup: row.blood_group,
    city: row.city,
    expoPushToken: row.expo_push_token,
    termsAccepted: !!row.terms_accepted,
    termsAcceptedAt: row.terms_accepted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

const USER_COLUMNS = `id, name, email, contact, age, gender, blood_group, city,
  expo_push_token, terms_accepted, terms_accepted_at, created_at, updated_at`;

const getUserById = async (id) => {
  const [rows] = await pool.query(
    `SELECT ${USER_COLUMNS} FROM db_users WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
};

// Reads and verifies the JWT from the Authorization header.
const getTokenUserId = (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { error: "No token provided" };
  try {
    return { id: jwt.verify(token, process.env.JWT_SECRET).id };
  } catch {
    return { error: "Invalid or expired token" };
  }
};

// Turns MySQL duplicate-key errors into a friendly message.
const duplicateMessage = (error) => {
  const field = error.sqlMessage?.includes("contact") ? "contact" : "email";
  return `This ${field} is already registered`;
};

// ---------- Register ----------
const registerUser = async (req, res) => {
  try {
    const {
      name,
      password,
      email,
      age,
      gender,
      bloodGroup,
      city,
      contact,
      expoPushToken,
      termsAccepted,
    } = req.body;

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

    if (Number(age) < 18 || Number(age) > 50) {
      return res.status(400).json({ message: "Age must be between 18 and 50" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    if (name.trim().length < 1 || name.trim().length > 30) {
      return res
        .status(400)
        .json({ message: "Name must be between 1 and 30 characters" });
    }

    if (!GENDERS.includes(gender)) {
      return res.status(400).json({ message: "Invalid gender" });
    }

    if (!BLOOD_GROUPS.includes(bloodGroup)) {
      return res.status(400).json({ message: "Invalid blood group" });
    }

    if (!termsAccepted) {
      return res
        .status(400)
        .json({ message: "You must accept the terms and conditions" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanContact = String(contact).trim();

    const [existing] = await pool.query(
      `SELECT id FROM db_users WHERE email = ? LIMIT 1`,
      [cleanEmail],
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO db_users
        (name, email, password, age, gender, blood_group, city, contact,
         expo_push_token, terms_accepted, terms_accepted_at)
       VALUES (?,?,?,?,?,?,?,?,?,1,NOW())`,
      [
        name.trim(),
        cleanEmail,
        hashedPassword,
        Number(age),
        gender,
        bloodGroup,
        city.trim(),
        cleanContact,
        expoPushToken || null,
      ],
    );

    const user = await getUserById(result.insertId);

    const token = jwt.sign({ id: result.insertId }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      message: "Registered Successfully",
      token,
      user: { user: formatUser(user) },
    });
    console.log("Registered Successfully");
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: duplicateMessage(error) });
    }
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------- Login ----------
const loginUser = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    const { email, password } = req.body || {};

    if (!email || !password)
      return res.status(400).json({ message: "Email and Password required" });

    const [rows] = await pool.query(
      `SELECT ${USER_COLUMNS}, password FROM db_users WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()],
    );
    const user = rows[0];

    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(400).json({ message: "Incorrect password" });

    if (req.body.expoPushToken) {
      await pool.query(`UPDATE db_users SET expo_push_token = ? WHERE id = ?`, [
        req.body.expoPushToken,
        user.id,
      ]);
      user.expo_push_token = req.body.expoPushToken;
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res
      .status(200)
      .json({ message: "Login successful", token, user: formatUser(user) });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------- Get logged-in user ----------
const fetchLoginUser = async (req, res) => {
  try {
    const { id, error } = getTokenUserId(req);
    if (error) return res.status(401).json({ message: error });

    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Error fetching logged-in user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------- Update profile ----------
const UPDATE_FIELDS = {
  name: "name",
  age: "age",
  email: "email",
  gender: "gender",
  city: "city",
  bloodGroup: "blood_group",
};

const updateUser = async (req, res) => {
  try {
    const { id, error } = getTokenUserId(req);
    if (error) return res.status(401).json({ message: error });

    const sets = [];
    const values = [];

    for (const [field, column] of Object.entries(UPDATE_FIELDS)) {
      let value = req.body[field];
      if (value === undefined) continue;

      if (field === "name") {
        value = String(value).trim();
        if (value.length < 1 || value.length > 30) {
          return res
            .status(400)
            .json({ message: "Name must be between 1 and 30 characters" });
        }
      }
      if (field === "age") {
        value = Number(value);
        if (Number.isNaN(value) || value < 18 || value > 50) {
          return res
            .status(400)
            .json({ message: "Age must be between 18 and 50" });
        }
      }
      if (field === "email") value = String(value).toLowerCase().trim();
      if (field === "city") value = String(value).trim();
      if (field === "gender" && !GENDERS.includes(value)) {
        return res.status(400).json({ message: "Invalid gender" });
      }
      if (field === "bloodGroup" && !BLOOD_GROUPS.includes(value)) {
        return res.status(400).json({ message: "Invalid blood group" });
      }

      sets.push(`${column} = ?`);
      values.push(value);
    }

    if (sets.length > 0) {
      const [result] = await pool.query(
        `UPDATE db_users SET ${sets.join(", ")} WHERE id = ?`,
        [...values, id],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    const user = await getUserById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "User updated successfully",
      user: formatUser(user),
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: duplicateMessage(error) });
    }
    console.error("Update Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ---------- Push token (uses auth middleware -> req.user.id) ----------
const updatePushToken = async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) {
      return res.status(400).json({ message: "expoPushToken is required" });
    }

    const [result] = await pool.query(
      `UPDATE db_users SET expo_push_token = ? WHERE id = ?`,
      [expoPushToken, req.user.id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await getUserById(req.user.id);
    res.status(200).json({ message: "Push token updated", user: formatUser(user) });
  } catch (error) {
    console.error("Push token update error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------- All users (masked contact) ----------
const maskContact = (contact) => {
  if (!contact || contact.length < 10) return "Not available";
  return contact.slice(0, 2) + "XXXXXX" + contact.slice(-2);
};

const getAllUsers = async (req, res) => {
  try {
    const { id, error } = getTokenUserId(req);
    if (error) return res.status(401).json({ message: error });

    const [rows] = await pool.query(
      `SELECT id, name, city, blood_group, contact
       FROM db_users WHERE id <> ?`,
      [id],
    );

    const masked = rows.map((u) => ({
      _id: u.id,
      id: u.id,
      name: u.name,
      city: u.city,
      bloodGroup: u.blood_group,
      contact: maskContact(u.contact),
    }));

    res
      .status(200)
      .json({ message: "Users fetched successfully", users: masked });
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------- Reveal one donor's contact ----------
const revealContact = async (req, res) => {
  try {
    const { error } = getTokenUserId(req);
    if (error) return res.status(401).json({ message: error });

    const donorId = Number(req.params.id);
    if (!Number.isInteger(donorId) || donorId < 1) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [rows] = await pool.query(
      `SELECT contact FROM db_users WHERE id = ? LIMIT 1`,
      [donorId],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({ contact: rows[0].contact });
  } catch (error) {
    console.error("Reveal contact error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------- Delete account ----------

const deleteUser = async (req, res) => {
  try {
    const { id, error } = getTokenUserId(req);
    if (error) return res.status(401).json({ message: error });

    const [result] = await pool.query(`DELETE FROM db_users WHERE id = ?`, [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "User not found" });

    res
      .status(200)
      .json({ message: "User and related data deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// ---------- Forgot password (email code) ----------
const RESET_CODE_MINUTES = 10;
const MAX_RESET_ATTEMPTS = 5;

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.query(
      `SELECT id, name, email FROM db_users WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()],
    );
    const user = rows[0];

    // Same response whether or not the email exists (no account enumeration)
    if (user) {
      const code = crypto.randomInt(100000, 1000000).toString();

      await pool.query(
        `UPDATE db_users
         SET reset_code = ?, reset_code_expires = ?, reset_attempts = 0
         WHERE id = ?`,
        [
          hashCode(code),
          new Date(Date.now() + RESET_CODE_MINUTES * 60 * 1000),
          user.id,
        ],
      );

      await sendEmail({
        to: user.email,
        subject: "BloodLink - Password reset code",
        text: `Hi ${user.name}, your BloodLink password reset code is ${code}. It expires in ${RESET_CODE_MINUTES} minutes. If you did not request this, you can ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
            <h2 style="color:#D1001F;">BloodLink</h2>
            <p>Hi ${user.name},</p>
            <p>Use this code to reset your password:</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#D1001F;">${code}</p>
            <p>This code expires in ${RESET_CODE_MINUTES} minutes.</p>
            <p style="color:#888;">If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    }

    res.status(200).json({
      message: "If this email is registered, a reset code has been sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res
      .status(500)
      .json({ message: "Could not send reset email. Please try again." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};

    if (!email || !code || !newPassword) {
      return res
        .status(400)
        .json({ message: "Email, code and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const [rows] = await pool.query(
      `SELECT id, reset_code, reset_code_expires, reset_attempts
       FROM db_users WHERE email = ? LIMIT 1`,
      [email.toLowerCase().trim()],
    );
    const user = rows[0];

    if (
      !user ||
      !user.reset_code ||
      !user.reset_code_expires ||
      new Date(user.reset_code_expires) < new Date()
    ) {
      return res
        .status(400)
        .json({ message: "Code is invalid or has expired" });
    }

    if (user.reset_attempts >= MAX_RESET_ATTEMPTS) {
      return res
        .status(429)
        .json({ message: "Too many attempts. Please request a new code" });
    }

    if (hashCode(code) !== user.reset_code) {
      await pool.query(
        `UPDATE db_users SET reset_attempts = reset_attempts + 1 WHERE id = ?`,
        [user.id],
      );
      return res.status(400).json({ message: "Incorrect code" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE db_users
       SET password = ?, reset_code = NULL, reset_code_expires = NULL, reset_attempts = 0
       WHERE id = ?`,
      [hashedPassword, user.id],
    );

    res
      .status(200)
      .json({ message: "Password reset successful. Please login." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Internal server error" });
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
  forgotPassword,
  resetPassword,
};