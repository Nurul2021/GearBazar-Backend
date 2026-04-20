/**
 * Supplier Model
 */

const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Supplier name cannot exceed 100 characters"],
    },
    contactPerson: String,
    email: {
      type: String,
      lowercase: true,
    },
    phone: String,
    address: String,
    city: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    paymentTerms: {
      type: String,
      enum: ["cod", "credit", "prepaid"],
      default: "cod",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Supplier", supplierSchema);
