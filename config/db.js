import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 5,
  connectTimeout: 10000,
  timezone: "Z", 
});

const connectDB = async () => {
  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing in .env: ${missing.join(", ")}`);
    process.exit(1);
  }

  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log("✅ MySQL connected");
  } catch (error) {
    console.error("Failed to connect :", error.message);
    process.exit(1);
  }
};

export { pool };
export default connectDB;