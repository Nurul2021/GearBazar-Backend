/**
 * User Management Routes - Admin Operations
 */

const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  verifyUser,
  suspendUser,
  reactivateUser,
  promoteUser
} = require('../controllers/UserManagementController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

router.use(authenticate);
router.use(authorizeRoles('admin'));

router.get('/users', getAllUsers);
router.patch('/verify-user/:id', verifyUser);
router.patch('/suspend-user/:id', suspendUser);
router.patch('/reactivate-user/:id', reactivateUser);
router.patch('/promote-user/:id', promoteUser);

module.exports = router;
