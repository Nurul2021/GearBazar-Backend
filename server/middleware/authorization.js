/**
 * Authorization Middleware - Role & Verification Checks
 */

const { AppError } = require('./errorHandler');

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      return next(new AppError(
        `Access denied. Allowed roles: [${allowedRoles.join(', ')}]. Your role: ${req.userRole}`,
        403,
        'FORBIDDEN'
      ));
    }

    next();
  };
};

const checkVerification = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!req.isVerified) {
    return next(new AppError('Account verification required to access this resource', 403, 'NOT_VERIFIED'));
  }

  next();
};

const requireGarageOrSeller = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  const allowedRoles = ['garage', 'seller', 'admin'];
  if (!allowedRoles.includes(req.userRole)) {
    return next(new AppError(
      'This endpoint requires Garage, Seller, or Admin role',
      403,
      'FORBIDDEN'
    ));
  }

  next();
};

const requireVerifiedGarageOrSeller = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  const allowedRoles = ['garage', 'seller', 'admin'];
  if (!allowedRoles.includes(req.userRole)) {
    return next(new AppError(
      'This endpoint requires Garage, Seller, or Admin role',
      403,
      'FORBIDDEN'
    ));
  }

  if (!req.isVerified) {
    return next(new AppError(
      'Verified account required. Please verify your email or business credentials.',
      403,
      'NOT_VERIFIED'
    ));
  }

  next();
};

module.exports = {
  authorizeRoles,
  checkVerification,
  requireGarageOrSeller,
  requireVerifiedGarageOrSeller
};