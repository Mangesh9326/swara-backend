const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');

// Import your auth middlewares (adjust the path if necessary)
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Protect all routes with authentication
router.use(requireAuth);

// Anyone logged in can view the services (needed for the dropdowns)
router.get('/', serviceController.getServices);

// Only Admins can add or delete services
router.post('/', requireRole(['Admin']), serviceController.createService);
router.delete('/:id', requireRole(['Admin']), serviceController.deleteService);

module.exports = router;