/**
 * Rate Limiting Middleware
 * Prevents Brute Force attacks on login and forgot password
 */

const rateLimit = require("express-rate-limit");
const { AppError } = require("../middleware/errorHandler");

const genericLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: "LOGIN_LIMIT_EXCEEDED",
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return (
      req.ip + ":login:" + (req.body?.email || req.body?.username || "unknown")
    );
  },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    code: "PASSWORD_RESET_LIMIT_EXCEEDED",
    message: "Too many password reset requests. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return req.ip + ":forgot:" + (req.body?.email || "unknown");
  },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    code: "OTP_LIMIT_EXCEEDED",
    message: "Too many OTP requests. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req) => {
    return req.ip + ":otp:" + (req.body?.phone || req.body?.email || "unknown");
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    code: "REGISTER_LIMIT_EXCEEDED",
    message: "Too many account registrations. Please try again in 1 hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    code: "API_LIMIT_EXCEEDED",
    message: "Too many API requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  genericLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  otpLimiter,
  registerLimiter,
  apiLimiter,
};
