import "dotenv/config";   // must be the FIRST import

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB, { pool } from "./config/db.js";

import userRouter from "./routes/user.route.js";
import bloodRequestRoutes from "./routes/bloodRequestRoute.js";
import notificationRoute from "./routes/notificationRoute.js";

// __dirname is not available in ES modules, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// ----- Middlewares FIRST -----
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ----- Serve the public folder (privacy.html etc.) -----
app.use(express.static(path.join(__dirname, "public")));

// ----- Debug logger -----
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// ----- Connect to MySQL -----
connectDB();

// ----- Routes -----
app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy.html"));
});

app.get("/health", async (req, res) => {
  let dbStatus = "disconnected";
  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch (e) {
    dbStatus = "disconnected";
  }

  res.status(200).json({
    status: "ok",
    server: "running",
    mysql: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/users", userRouter);
app.use("/api/blood-request", bloodRequestRoutes);
app.use("/api/notifications", notificationRoute);

// ----- Start Server -----
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});