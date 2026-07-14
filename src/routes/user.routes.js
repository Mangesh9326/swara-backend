const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

// Apply authentication and Admin role requirement to ALL routes in this file
router.use(requireAuth);
router.use(requireRole(['Admin']));

router.get('/roles', userController.getRoles);
router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;