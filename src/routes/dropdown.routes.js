const express = require('express');
const router = express.Router();
const dropdownController = require('../controllers/dropdown.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(requireAuth);
router.get('/', dropdownController.getDropdowns); // Everyone can read
router.post('/', requireRole(['Admin']), dropdownController.saveDropdownOption); // Only Admin writes
router.delete('/:id', requireRole(['Admin']), dropdownController.deleteDropdownOption); // Only Admin deletes

module.exports = router;