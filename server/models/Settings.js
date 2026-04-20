/**
 * Settings Model - Global Site Configuration
 */

const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    siteLogo: {
      type: String,
      default: null,
    },
    siteName: {
      type: String,
      default: "GearBazar",
    },
    contactEmail: {
      type: String,
      default: "support@gearbazar.com",
    },
    contactPhone: {
      type: String,
      default: "+1-800-GEARBAZAR",
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "USA" },
    },
    shippingCharges: {
      standard: { type: Number, default: 9.99 },
      express: { type: Number, default: 19.99 },
      freeShippingThreshold: { type: Number, default: 100 },
      freeShippingEnabled: { type: Boolean, default: false },
    },
    taxSettings: {
      enabled: { type: Boolean, default: true },
      defaultRate: { type: Number, default: 8 },
    },
    socialLinks: {
      facebook: String,
      twitter: String,
      instagram: String,
      linkedin: String,
    },
    currency: {
      code: { type: String, default: "USD" },
      symbol: { type: String, default: "$" },
    },
    timezone: {
      type: String,
      default: "America/New_York",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

settingsSchema.index({});

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
