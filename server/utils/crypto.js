/**
 * Crypto Utility - Secure Token Generation
 */

const crypto = require('crypto');

const generateResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const tokenExpiry = Date.now() + 30 * 60 * 1000;
  
  return {
    token: resetToken,
    hashedToken,
    expiresAt: new Date(tokenExpiry)
  };
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  generateResetToken,
  hashToken
};