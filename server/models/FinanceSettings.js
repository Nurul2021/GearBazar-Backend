/**
 * Finance Settings Model - Global Commission & Platform Config
 */

const mongoose = require("mongoose");

const financeSettingsSchema = new mongoose.Schema(
  {
    commissionPercentage: {
      type: Number,
      default: 10,
      min: [0, "Commission cannot be negative"],
      max: [100, "Commission cannot exceed 100%"],
      required: true,
    },
    minimumWithdrawalAmount: {
      type: Number,
      default: 100,
      min: 0,
    },
    withdrawalProcessingDays: {
      type: Number,
      default: 3,
      min: 1,
    },
    paymentGateways: {
      bankTransfer: {
        enabled: Boolean,
        bankName: String,
        accountNumber: String,
        routingNumber: String,
      },
      bkash: { enabled: Boolean, number: String },
      nagad: { enabled: Boolean, number: String },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

financeSettingsSchema.index({});

const FinanceSettings = mongoose.model(
  "FinanceSettings",
  financeSettingsSchema,
);

module.exports = FinanceSettings;
