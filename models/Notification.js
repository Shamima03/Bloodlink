import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false }, // optional
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
