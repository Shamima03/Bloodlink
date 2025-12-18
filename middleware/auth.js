import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";

export default (req, res, next) => {
  try {
    // const authHeader = req.header("Authorization");
    // const token = authHeader?.split(" ")[1]; // <-- FIX

    const authHeader = req.header("Authorization");
    // console.log("AUTH HEADER:", authHeader);

    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token." });
    }

    // console.log("TOKEN:", token);
    const decoded =jwt.verify(token, process.env.JWT_SECRET);
    // console.log("Decode ", decoded);
    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT VERIFY ERROR:", error);
    return res
      .status(401)
      .json({ message: "Invalid token", error: error.message });
  }
};
