const db = require('../config/db');
const socketManager = require('../utils/socket');

// Get all notifications for a user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id; 
    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    const { rows } = await db.query(query, [userId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// Mark a single notification or all as read
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.body; // If null, mark all as read

    if (notificationId) {
      await db.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
    } else {
      await db.query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification" });
  }
};

// Helper function to create notifications internally (used by other controllers)
exports.createNotification = async (userId, title, message, type = 'info', link = null) => {
  try {
    // 1. Save to PostgreSQL
    const { rows } = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, link) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, title, message, type, link]
    );

    const newNotification = rows[0];

    // 2. Check if the user is currently online
    const userSocketId = socketManager.getUserSocket(userId);
    
    // 3. If they are online, instantly emit the notification to their specific socket!
    if (userSocketId) {
      socketManager.getIO().to(userSocketId).emit('new_notification', newNotification);
    }
    
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};