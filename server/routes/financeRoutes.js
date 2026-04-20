/**
 * Finance Management Routes
 */

const express = require('express');
const router = express.Router();
const {
  getCommissionSettings,
  updateCommissionSettings,
  createWithdrawalRequest,
  getVendorEarnings,
  getAllWithdrawalRequests,
  processWithdrawal,
  getMonthlySalesReport,
  getPlatformEarnings,
  getVendorWithdrawalHistory
} = require('../controllers/FinanceController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

router.get('/settings', authenticate, authorizeRoles('admin'), getCommissionSettings);
router.put('/settings', authenticate, authorizeRoles('admin'), updateCommissionSettings);

router.get('/platform-earnings', authenticate, authorizeRoles('admin'), getPlatformEarnings);
router.get('/monthly-report', authenticate, authorizeRoles('admin'), getMonthlySalesReport);

router.get('/withdrawals', authenticate, authorizeRoles('admin'), getAllWithdrawalRequests);
router.patch('/withdrawals/:id', authenticate, authorizeRoles('admin'), processWithdrawal);

router.get('/vendor/earnings', authenticate, authorizeRoles('seller', 'garage'), getVendorEarnings);
router.post('/vendor/withdraw', authenticate, authorizeRoles('seller', 'garage'), createWithdrawalRequest);
router.get('/vendor/withdrawals', authenticate, authorizeRoles('seller', 'garage'), getVendorWithdrawalHistory);

module.exports = router;
