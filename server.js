import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import connectDB from "./config/db.js";

import userRouter from "./routes/user.route.js";
import bloodRequestRoutes from './routes/bloodRequestRoute.js';
import notificationRoute from "./routes/notificationRoute.js";

const app = express();
const PORT = process.env.PORT || 8000;

// ----- Middlewares FIRST -----
app.use(cors());                                    // ✅ cors first
app.use(express.json({ limit: "5mb" }));           // ✅ json once
app.use(express.urlencoded({ extended: true }));

// ----- Add this to debug -----
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);      // ✅ log all requests
  next();
});

// ----- Connect to MongoDB -----
connectDB();

// ----- Routes -----
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  res.status(200).json({ status: "ok", server: "running", mongo: statusMap[dbStatus], timestamp: new Date().toISOString() });
});

app.use("/api/users", userRouter);
app.use("/api/blood-request", bloodRequestRoutes);  // ✅ correct
app.use("/api/notifications", notificationRoute);

// ----- Start Server -----
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});