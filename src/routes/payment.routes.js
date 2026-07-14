const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

router.use(requireAuth);

router.get('/', requireAuth, paymentController.getPayments);

module.exports = router;