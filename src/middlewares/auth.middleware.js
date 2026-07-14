import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication token missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active
    const userQuery = `
      SELECT u.id, u.email, u.is_active, r.name as role_name 
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `;
    const { rows } = await query(userQuery, [decoded.id]);

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ error: 'User account not found or deactivated' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};