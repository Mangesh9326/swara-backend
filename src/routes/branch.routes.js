const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(requireAuth);

// Everyone authenticated can view branches (for dropdowns)
router.get('/', branchController.getBranches);

// Only Admins can Manage (CRUD) branches
router.post('/', requireRole(['Admin']), branchController.createBranch);
router.put('/:id', requireRole(['Admin']), branchController.updateBranch);
router.delete('/:id', requireRole(['Admin']), branchController.deleteBranch);

module.exports = router;