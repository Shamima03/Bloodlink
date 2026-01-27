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
app.use(express.json());
app.use("/api/notifications", notificationRoute);

// ----- Environment -----
const PORT = process.env.PORT || 8000;

// ----- Connect to MongoDB -----
connectDB();

// ----- Middlewares -----
app.use(cors());
app.use(express.json({ limit: "5mb" }));


// Optional: parse URL-encoded bodies (for forms)
app.use(express.urlencoded({ extended: true }));
// ----- Health Check Route -----
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;

  const statusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    status: "ok",
    server: "running",
    mongo: statusMap[dbStatus],
    timestamp: new Date().toISOString(),
  });
});

// routes declaration

app.use("/api/users", userRouter);
app.use("/api/blood-request", bloodRequestRoutes);
// ----- Start Server -----
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
