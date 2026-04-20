/**
 * Role-Based Access Control (RBAC) Middleware
 * DRY: Reusable role checkers and composed middleware factories
 */

const { AppError } = require('./errorHandler');

const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  GARAGE_OWNER: 'garage_owner',
  CUSTOMER: 'customer'
};

const ROLE_GROUPS = {
  BUSINESS: [ROLES.ADMIN, ROLES.SELLER, ROLES.GARAGE_OWNER],
  PRIVILEGED: [ROLES.ADMIN, ROLES.SELLER],
  ANY: Object.values(ROLES)
};

const checkRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!allowedRoles.includes(req.userRole)) {
    return next(new AppError(
      `Access denied. Required roles: [${allowedRoles.join(', ')}]. Your role: ${req.userRole}`,
      403,
      'FORBIDDEN'
    ));
  }

  next();
};

const checkRoleGroup = (group) => checkRole(...ROLE_GROUPS[group]);

const requireVerified = (req, res, next) => {
  if (!req.isVerified) {
    return next(new AppError('Account verification required', 403, 'NOT_VERIFIED'));
  }
  next();
};

const checkRoleAndVerified = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!roles.includes(req.userRole)) {
    return next(new AppError(
      `Access denied. Required roles: [${roles.join(', ')}]`,
      403,
      'FORBIDDEN'
    ));
  }

  if (!req.isVerified) {
    return next(new AppError('Verified account required', 403, 'NOT_VERIFIED'));
  }

  next();
};

const requireActive = (req, res, next) => {
  if (!req.user?.isActive) {
    return next(new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE'));
  }
  next();
};

const canAccessWholesale = (req) => {
  if (!req.user) return false;
  const allowedRoles = [ROLES.ADMIN, ROLES.SELLER, ROLES.GARAGE_OWNER];
  return allowedRoles.includes(req.userRole) && req.isVerified && req.user.isActive !== false;
};

const requireWholesaleAccess = (req, res, next) => {
  if (!canAccessWholesale(req)) {
    return next(new AppError(
      'Wholesale access requires verified business account (Seller, Garage Owner, or Admin)',
      403,
      'NO_WHOLESALE_ACCESS'
    ));
  }
  next();
};

const createRoleMiddleware = (config) => {
  const { roles = [], requireVerification = false, requireActiveAccount = true } = config;

  return (req, res, next) => {
    if (requireActiveAccount && !req.user?.isActive) {
      return next(new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE'));
    }

    if (roles.length && !roles.includes(req.userRole)) {
      return next(new AppError(
        `Access denied. Required: [${roles.join(', ')}]. Your role: ${req.userRole}`,
        403,
        'FORBIDDEN'
      ));
    }

    if (requireVerification && !req.isVerified) {
      return next(new AppError('Account verification required', 403, 'NOT_VERIFIED'));
    }

    next();
  };
};

const authorize = (...roles) => checkRole(...roles);
const authorizeAny = () => checkRole(...ROLE_GROUPS.ANY);
const authorizeBusiness = () => checkRoleGroup('BUSINESS');
const authorizePrivileged = () => checkRoleGroup('PRIVILEGED');

const isAdmin = () => checkRole(ROLES.ADMIN);
const isSeller = () => checkRole(ROLES.SELLER);
const isGarageOwner = () => checkRole(ROLES.GARAGE_OWNER);
const isCustomer = () => checkRole(ROLES.CUSTOMER);

const isAdminOrVerified = () => checkRoleAndVerified(ROLES.ADMIN);
const isSellerOrVerified = () => checkRoleAndVerified(ROLES.SELLER, ROLES.ADMIN);
const isGarageOwnerOrVerified = () => checkRoleAndVerified(ROLES.GARAGE_OWNER, ROLES.ADMIN);

module.exports = {
  ROLES,
  ROLE_GROUPS,
  authorize,
  authorizeAny,
  authorizeBusiness,
  authorizePrivileged,
  checkRole,
  checkRoleGroup,
  requireVerified,
  requireActive,
  requireWholesaleAccess,
  canAccessWholesale,
  createRoleMiddleware,
  isAdmin,
  isSeller,
  isGarageOwner,
  isCustomer,
  isAdminOrVerified,
  isSellerOrVerified,
  isGarageOwnerOrVerified
};