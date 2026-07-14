const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// All application routes require authentication
router.use(requireAuth);

// GET: Everyone can view applications
router.get('/', applicationController.getApplications);

// POST/PUT: Only Admins and Operators can create or edit
router.post('/', requireRole(['Admin', 'Operator']), applicationController.createApplication);
router.put('/:id', requireRole(['Admin', 'Operator']), applicationController.updateApplication);

module.exports = router;