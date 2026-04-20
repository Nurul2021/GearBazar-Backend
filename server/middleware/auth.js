/**
 * JWT Authentication Middleware
 * DRY: Token extraction and verification logic centralized
 */

const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");
const { AppError } = require("./errorHandler");

const EXTRACT_TOKEN_REGEX = /^Bearer\s+(.+)$/i;

const extractToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== "string") return null;
  const match = authHeader.match(EXTRACT_TOKEN_REGEX);
  return match ? match[1] : null;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new AppError("Token expired", 401, "TOKEN_EXPIRED");
    }
    throw new AppError("Invalid token", 401, "INVALID_TOKEN");
  }
};

const attachUser = (user, req) => {
  if (!user) {
    req.user = null;
    req.userId = null;
    req.userRole = null;
    req.isVerified = false;
    return;
  }
  req.user = user;
  req.userId = user._id;
  req.userRole = user.role;
  req.isVerified = user.isVerified;
};

const authenticate = (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw new AppError("No token provided", 401, "NO_TOKEN");
    }

    const decoded = verifyToken(token);

    User.findById(decoded.userId)
      .select("-password")
      .then((user) => {
        if (!user) {
          throw new AppError("User not found", 401, "USER_NOT_FOUND");
        }
        if (!user.isActive && user.role !== "admin") {
          throw new AppError("Account is inactive", 401, "ACCOUNT_INACTIVE");
        }
        attachUser(user, req);
        next();
      })
      .catch(next);
  } catch (error) {
    next(error);
  }
};

const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      attachUser(null, req);
      return next();
    }

    const decoded = verifyToken(token);

    User.findById(decoded.userId)
      .select("-password")
      .lean()
      .then((user) => {
        attachUser(user, req);
        next();
      })
      .catch(() => {
        attachUser(null, req);
        next();
      });
  } catch (error) {
    attachUser(null, req);
    next();
  }
};

const requireVerified = (req, res, next) => {
  if (!req.isVerified) {
    return next(
      new AppError("Account verification required", 403, "NOT_VERIFIED"),
    );
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireVerified,
  requireAuth: authenticate,
  extractToken,
  verifyToken,
};
