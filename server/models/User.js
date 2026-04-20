/**
 * User Model - Secure Mongoose Schema
 * Auto-parts Multi-vendor Platform
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { AppError } = require("../middleware/errorHandler");

const VALID_ROLES = ["admin", "seller", "garage", "customer"];

const shopDetailsSchema = new mongoose.Schema(
  {
    shopName: { type: String, maxlength: 100 },
    shopDescription: { type: String, maxlength: 500 },
    businessLicense: { type: String, maxlength: 50 },
    taxId: { type: String, maxlength: 50 },
    bankAccount: {
      bankName: { type: String, maxlength: 100 },
      accountNumber: { type: String, maxlength: 30 },
      routingNumber: { type: String, maxlength: 20 },
    },
    garageDetails: {
      garageName: { type: String, maxlength: 100 },
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: { type: String, default: "USA" },
      },
      phone: { type: String, maxlength: 20 },
      workingHours: {
        monday: { open: String, close: String },
        tuesday: { open: String, close: String },
        wednesday: { open: String, close: String },
        thursday: { open: String, close: String },
        friday: { open: String, close: String },
        saturday: { open: String, close: String },
        sunday: { open: String, close: String },
      },
      services: [
        {
          name: String,
          description: String,
          price: Number,
        },
      ],
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      maxlength: [100, "Password cannot exceed 100 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: VALID_ROLES,
        message: "Invalid role. Must be one of: " + VALID_ROLES.join(", "),
      },
      default: "customer",
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPendingVerification: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationApprovedAt: { type: Date },
    verificationApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: { type: String, maxlength: 500 },
    rejectionDate: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    suspensionReason: { type: String, maxlength: 500 },
    suspendedAt: { type: Date },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reactivatedAt: { type: Date },
    reactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    promotedAt: { type: Date },
    promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    previousRole: { type: String, enum: VALID_ROLES },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    shopDetails: {
      type: shopDetailsSchema,
      default: () => ({}),
    },
    verificationToken: { type: String, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, isVerified: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  if (this.isNew || this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword) {
    throw new AppError(
      "Password is required for comparison",
      400,
      "INVALID_INPUT",
    );
  }
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isPasswordChangedAfter = function (JWTIssuedAt) {
  if (this.passwordChangedAt) {
    const changedTimestamp = this.passwordChangedAt.getTime() / 1000;
    return JWTIssuedAt < changedTimestamp;
  }
  return false;
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  return obj;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
