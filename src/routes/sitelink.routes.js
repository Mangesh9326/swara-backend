const express = require('express');
const router = express.Router();
const siteLinkController = require('../controllers/sitelink.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Apply authentication to all routes in this file
router.use(requireAuth);

// GET is accessible to all authenticated users
router.get('/', siteLinkController.getSiteLinks);

// POST, PUT, DELETE are restricted to Admins only
router.post('/', requireRole(['Admin']), siteLinkController.createSiteLink);
router.put('/:id', requireRole(['Admin']), siteLinkController.updateSiteLink);
router.delete('/:id', requireRole(['Admin']), siteLinkController.deleteSiteLink);

module.exports = router;