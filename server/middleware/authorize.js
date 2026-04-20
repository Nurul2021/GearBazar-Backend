/**
 * Role-Based Authorization Middleware
 * DRY: Re-exports from roleMiddleware for backward compatibility
 */

const roleMiddleware = require('./roleMiddleware');

const authorize = roleMiddleware.authorize;
const isVerified = roleMiddleware.requireVerified;

module.exports = {
  authorize,
  isVerified,
  ...roleMiddleware
};