/**
 * Verification Document Model
 */

const mongoose = require("mongoose");

const verificationDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["trade_license", "nid", "shop_photo", "bank_statement"],
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
    },
    mimeType: {
      type: String,
    },
    size: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      maxlength: 500,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

verificationDocumentSchema.index({ userId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model(
  "VerificationDocument",
  verificationDocumentSchema,
);
