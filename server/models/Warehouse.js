/**
 * Warehouse Model
 */

const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      unique: true,
      trim: true,
      maxlength: [100, "Warehouse name cannot exceed 100 characters"],
    },
    location: {
      address: String,
      city: String,
      district: String,
      division: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    capacity: {
      type: Number,
      default: 0,
    },
    currentStock: {
      type: Number,
      default: 0,
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

module.exports = mongoose.model("Warehouse", warehouseSchema);
