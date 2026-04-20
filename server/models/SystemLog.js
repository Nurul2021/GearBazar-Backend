/**
 * System Log Model - Admin Activity Audit Trail
 */

const mongoose = require("mongoose");

const systemLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "USER_VERIFIED",
        "USER_REJECTED",
        "USER_SUSPENDED",
        "USER_ACTIVATED",
        "PRODUCT_APPROVED",
        "PRODUCT_REJECTED",
        "PRODUCT_DELETED",
        "ORDER_STATUS_CHANGED",
        "WITHDRAWAL_PROCESSED",
        "WITHDRAWAL_REJECTED",
        "SETTINGS_UPDATED",
        "CATEGORY_CREATED",
        "CATEGORY_UPDATED",
        "CATEGORY_DELETED",
        "REVIEW_DELETED",
        "REFUND_ISSUED",
        "COMMISSION_UPDATED",
        "LOGIN",
        "LOGOUT",
        "DATA_EXPORT",
        "BACKUP_CREATED",
      ],
    },
    targetType: {
      type: String,
      enum: [
        "User",
        "Product",
        "Order",
        "Withdrawal",
        "Category",
        "Settings",
        "Review",
        "Refund",
        "General",
      ],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    targetName: {
      type: String,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ adminId: 1, createdAt: -1 });
systemLogSchema.index({ action: 1, createdAt: -1 });
systemLogSchema.index({ targetType: 1, targetId: 1 });

systemLogSchema.statics.log = async function (data) {
  return this.create({
    adminId: data.adminId,
    adminName: data.adminName,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
    targetName: data.targetName,
    description: data.description,
    previousValue: data.previousValue,
    newValue: data.newValue,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    status: data.status || "success",
    errorMessage: data.errorMessage,
  });
};

const SystemLog = mongoose.model("SystemLog", systemLogSchema);

module.exports = SystemLog;
