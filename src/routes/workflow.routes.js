const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(requireAuth);

// Admin Assignment CRUD
router.get('/assignments', requireRole(['Admin']), workflowController.getAssignments);
router.post('/assignments', requireRole(['Admin']), workflowController.assignStatus);

// Pending Work
router.get('/pending', workflowController.getPendingWork);

// Application Specific
router.put('/applications/:id/status', workflowController.updateApplicationStatus);
router.get('/applications/:id/history', workflowController.getApplicationHistory);

router.get('/statuses', workflowController.getWorkflowStatuses);

//Moniter
router.get('/monitor', requireRole(['Admin']), workflowController.getMonitorData);

module.exports = router;