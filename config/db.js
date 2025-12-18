import mongoose from "mongoose";

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ MONGO_URI is not defined in .env");
    process.exit(1);
  }
  try {
  await mongoose.connect(mongoUri, {
    autoIndex: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("Failed to connect :", error);
    process.exit(1);
  }
};
export default connectDB;