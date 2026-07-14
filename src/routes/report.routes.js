const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const reportController = require('../controllers/report.controller');
const { requireAuth } = require('../middlewares/auth.middleware'); // Assuming you use this

// Ensure the uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); 
  },
  filename: function (req, file, cb) {
    // Create a unique filename to prevent overwriting
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

// The 'attachments' string MUST match the key in your React FormData
router.post('/', requireAuth, upload.array('attachments', 10), reportController.submitReport);

module.exports = router;