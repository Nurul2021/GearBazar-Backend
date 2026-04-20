/**
 * Server Configuration
 * Environment variables and app settings
 */

require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/gearbazar",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",

  // Email configuration
  email: {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASS || "",
    },
  },

  // SMS configuration
  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
  },

  // Payment configuration
  payment: {
    bkash: {
      appKey: process.env.BKASH_APP_KEY || "",
      appSecret: process.env.BKASH_APP_SECRET || "",
      username: process.env.BKASH_USERNAME || "",
      password: process.env.BKASH_PASSWORD || "",
      baseUrl: process.env.BKASH_BASE_URL || "https://checkout.sandbox.bka.sh",
    },
  },

  // Upload configuration
  upload: {
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
      apiKey: process.env.CLOUDINARY_API_KEY || "",
      apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    },
  },
};
