/**
 * Dashboard Routes - Role-Based
 */

const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/DashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getDashboard);

module.exports = router;