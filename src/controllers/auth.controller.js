const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db"); // Import the DB connection

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Fetch user and their role from the database
    const userQuery = `
      SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.is_active, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1 AND u.deleted_at IS NULL
    `;
    
    const { rows } = await db.query(userQuery, [email]);

    // If user not found
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ error: "Account deactivated. Contact Admin." });
    }

    // Verify Password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, role: user.role_name },
      process.env.JWT_SECRET || "fallback_super_secret_key",
      { expiresIn: "8h" }
    );

    // Remove the password hash before sending it to the frontend
    delete user.password_hash;

    // Log the successful login in activity_logs (Optional but highly recommended)
    await db.query(
      `INSERT INTO activity_logs (user_id, action, entity_type, ip_address) VALUES ($1, $2, $3, $4)`,
      [user.id, 'User Login', 'Authentication', req.ip]
    );

    return res.status(200).json({
      message: "Login successful",
      token: token,
      user: user
    });

  } catch (error) {
    console.error("Login API Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};