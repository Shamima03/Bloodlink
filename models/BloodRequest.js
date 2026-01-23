import mongoose from "mongoose";

const bloodRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    patientName: { type: String, required: true },
    hospital: { type: String, required: true },
    location: { type: String, required: true },

    bloodGroup: {
      type: String,
      required: true,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    units: { type: Number, required: true },
    contact: { type: String, required: true },
    deadline: { type: Date, required: true },
    isCompleted: { type: Boolean, default: false },

    // Users who clicked interest icon
    interests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("BloodRequest", bloodRequestSchema);
