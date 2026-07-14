import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected successfully");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const query = (text, params) => pool.query(text, params);
export default pool;