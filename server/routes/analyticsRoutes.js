/**
 * Analytics Routes - Vendor Analytics
 */

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/AnalyticsController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

router.get(
  '/',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  AnalyticsController.getVendorAnalytics
);

router.get(
  '/quick',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  AnalyticsController.getQuickStats
);

module.exports = router;