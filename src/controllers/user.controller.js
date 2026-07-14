const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const db = require('../config/db');

// GET: Fetch all active users (excluding passwords)
exports.getUsers = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.branch, u.is_active, u.created_at, 
             r.id as role_id, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
    `;
    const { rows } = await db.query(query);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET: Fetch available roles for the dropdown form
exports.getRoles = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name FROM roles WHERE deleted_at IS NULL ORDER BY name');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

// POST: Create a new user
exports.createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, password, role_id, branch, is_active } = req.body;

    // Hash password efficiently in a single step
    const password_hash = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO users (first_name, last_name, email, password_hash, role_id, branch, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, first_name, email, branch
    `;

    // Ensure branch is explicitly null if omitted to save DB space
    const finalBranch = branch || null;

    // Fixed bug: Used db.query instead of undefined db.query
    const { rows } = await db.query(insertQuery, [
      first_name, last_name, email, password_hash, role_id, finalBranch, is_active
    ]);

    res.status(201).json({ message: 'User created successfully', user: rows[0] });
  } catch (error) {
    if (error.code === '23505') { 
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// PUT: Update an existing user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, role_id, branch, is_active, password } = req.body;

    const finalBranch = branch || null;
    let query, params;

    if (password && password.length > 0) {
      // Single-step hashing
      const password_hash = await bcrypt.hash(password, 10);

      query = `
        UPDATE users 
        SET first_name = $1, last_name = $2, email = $3, role_id = $4, branch = $5, is_active = $6, password_hash = $7, updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
      `;
      params = [first_name, last_name, email, role_id, finalBranch, is_active, password_hash, id];
    } else {
      query = `
        UPDATE users 
        SET first_name = $1, last_name = $2, email = $3, role_id = $4, branch = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
      `;
      params = [first_name, last_name, email, role_id, finalBranch, is_active, id];
    }

    await db.query(query, params);

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// DELETE: Soft delete a user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const deleteQuery = `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = false WHERE id = $1`;
    const { rowCount } = await db.query(deleteQuery, [id]); // rowCount is faster than checking returned arrays

    if (rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // MAKE RESPONSE FASTER: Send success back to the user immediately
    res.status(200).json({ message: 'User deleted successfully' });

    // Execute the Activity Log asynchronously in the background (does not block the user response)
    db.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, 'Deleted User', 'Users', id, req.ip || '0.0.0.0']
    ).catch(err => console.error('Failed background activity log:', err));

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};