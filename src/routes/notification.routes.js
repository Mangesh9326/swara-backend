const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead } = require('../controllers/notification.controller');
const { requireAuth } = require('../middlewares/auth.middleware'); // Use your actual auth middleware

// Get all notifications for logged-in user
router.get('/', requireAuth, getNotifications);

// Mark notification(s) as read
router.post('/mark-read', requireAuth, markAsRead);

module.exports = router;