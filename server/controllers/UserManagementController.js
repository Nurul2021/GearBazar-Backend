/**
 * User Management Controller - Admin Operations
 */

const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const getAllUsers = async (req, res, next) => {
  try {
    const { role, isVerified, isActive, page = 1, limit = 20, search } = req.query;

    const query = {};

    if (role) query.role = role;
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    const stats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: stats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
};

const verifyUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const adminId = req.userId;

    const user = await User.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!['seller', 'garage'].includes(user.role)) {
      throw new AppError('Only sellers and garages can be verified', 400, 'INVALID_ROLE');
    }

    if (action === 'approve') {
      user.isVerified = true;
      user.isPendingVerification = false;
      user.verificationApprovedAt = new Date();
      user.verificationApprovedBy = adminId;
      user.rejectionReason = undefined;
      user.rejectionDate = undefined;
      user.rejectedBy = undefined;

      await user.save();

      return res.status(200).json({
        success: true,
        message: `User ${user.role} verified successfully`,
        data: {
          userId: user._id,
          isVerified: user.isVerified,
          verificationApprovedAt: user.verificationApprovedAt
        }
      });
    } else if (action === 'reject') {
      if (!reason) {
        throw new AppError('Rejection reason is required', 400, 'REASON_REQUIRED');
      }

      user.isVerified = false;
      user.isPendingVerification = false;
      user.rejectionReason = reason;
      user.rejectionDate = new Date();
      user.rejectedBy = adminId;
      user.verificationApprovedAt = undefined;
      user.verificationApprovedBy = undefined;

      await user.save();

      return res.status(200).json({
        success: true,
        message: 'User verification rejected',
        data: {
          userId: user._id,
          rejectionReason: reason
        }
      });
    } else {
      throw new AppError('Invalid action. Use "approve" or "reject"', 400, 'INVALID_ACTION');
    }
  } catch (error) {
    next(error);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === 'admin') {
      throw new AppError('Cannot suspend admin users', 403, 'FORBIDDEN');
    }

    if (!user.isActive) {
      throw new AppError('User is already suspended', 400, 'ALREADY_SUSPENDED');
    }

    user.isActive = false;
    user.suspensionReason = reason || 'Suspended by admin';
    user.suspendedAt = new Date();
    user.suspendedBy = req.userId;
    user.reactivatedAt = undefined;
    user.reactivatedBy = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User suspended successfully',
      data: {
        userId: user._id,
        isActive: user.isActive,
        suspensionReason: user.suspensionReason
      }
    });
  } catch (error) {
    next(error);
  }
};

const reactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.isActive) {
      throw new AppError('User is already active', 400, 'ALREADY_ACTIVE');
    }

    user.isActive = true;
    user.suspensionReason = undefined;
    user.suspendedAt = undefined;
    user.suspendedBy = undefined;
    user.reactivatedAt = new Date();
    user.reactivatedBy = req.userId;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User reactivated successfully',
      data: {
        userId: user._id,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

const promoteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;

    const validRoles = ['admin', 'seller', 'garage', 'customer'];

    if (!newRole || !validRoles.includes(newRole)) {
      throw new AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, 'INVALID_ROLE');
    }

    const user = await User.findById(id);

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (user.role === newRole) {
      throw new AppError('User already has this role', 400, 'SAME_ROLE');
    }

    const oldRole = user.role;
    user.role = newRole;
    user.promotedAt = new Date();
    user.promotedBy = req.userId;
    user.previousRole = oldRole;

    await user.save();

    res.status(200).json({
      success: true,
      message: `User promoted from ${oldRole} to ${newRole}`,
      data: {
        userId: user._id,
        previousRole: oldRole,
        currentRole: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  verifyUser,
  suspendUser,
  reactivateUser,
  promoteUser
};
