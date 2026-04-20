/**
 * Notification Model - Multi-channel Notification Storage
 */

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "ORDER_PLACED",
        "ORDER_CONFIRMED",
        "ORDER_PROCESSING",
        "ORDER_SHIPPED",
        "ORDER_DELIVERED",
        "ORDER_CANCELLED",
        "PAYMENT_RECEIVED",
        "PAYMENT_FAILED",
        "REFUND_INITIATED",
        "REFUND_COMPLETED",
        "WITHDRAWAL_REQUEST",
        "WITHDRAWAL_PROCESSED",
        "PRODUCT_APPROVED",
        "PRODUCT_REJECTED",
        "PRODUCT_OUT_OF_STOCK",
        "USER_VERIFIED",
        "USER_SUSPENDED",
        "PASSWORD_RESET",
        "EMAIL_VERIFICATION",
        "OTP_VERIFICATION",
        "PROMOTIONAL",
        "SYSTEM",
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    channel: {
      type: String,
      enum: ["in_app", "email", "sms", "push"],
      default: "in_app",
    },
    status: {
      type: String,
      enum: ["unread", "read", "archived"],
      default: "unread",
      index: true,
    },
    readAt: {
      type: Date,
    },
    sentViaEmail: {
      type: Boolean,
      default: false,
    },
    sentViaSms: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
    smsSentAt: {
      type: Date,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    referenceModel: {
      type: String,
      enum: ["Order", "Product", "User", "Withdrawal", "Refund"],
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

notificationSchema.methods.markAsRead = async function () {
  this.status = "read";
  this.readAt = new Date();
  return this.save();
};

notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, status: "unread" });
};

notificationSchema.statics.getUnreadNotifications = async function (userId) {
  return this.find({ userId, status: "unread" }).sort({ createdAt: -1 });
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
