/**
 * Configuration Module - Loads environment variables
 */

const dotenv = require('dotenv');

dotenv.config();

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gearbazar',
  mongoUser: process.env.MONGODB_USER || '',
  mongoPassword: process.env.MONGODB_PASSWORD || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
  uploadPath: process.env.UPLOAD_PATH || './uploads'
};

module.exports = config;