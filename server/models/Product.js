/**
 * Product Model - Auto-parts Multi-vendor Marketplace
 *
 * Fields:
 * - title, slug, description, brand
 * - category (ObjectId), subCategory
 * - compatibility (make, model, years)
 * - pricing (publicPrice, wholesalePrice)
 * - inventory (stockQuantity, sku, unit)
 * - media (images)
 * - vendor (vendorId)
 */

const mongoose = require("mongoose");

const compatibilitySchema = new mongoose.Schema(
  {
    make: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      example: "TOYOTA",
    },
    model: {
      type: String,
      required: true,
      trim: true,
      example: "Corolla",
    },
    years: {
      type: String,
      required: true,
      example: "2015-2022",
    },
    trim: { type: String, trim: true },
    engine: { type: String, trim: true },
    note: { type: String },
  },
  { _id: false },
);

const pricingSchema = new mongoose.Schema(
  {
    publicPrice: {
      type: Number,
      required: [true, "Public price is required"],
      min: [0, "Price cannot be negative"],
    },
    wholesalePrice: {
      type: Number,
      required: [true, "Wholesale price is required"],
      min: [0, "Wholesale price cannot be negative"],
    },
    costPrice: {
      type: Number,
      min: [0, "Cost price cannot be negative"],
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    minOrderQty: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false },
);

const inventorySchema = new mongoose.Schema(
  {
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock quantity must be an integer",
      },
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    unit: {
      type: String,
      enum: ["pcs", "set", "box", "pair", "liter", "kg", "meter"],
      default: "pcs",
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    allowBackorder: {
      type: Boolean,
      default: false,
    },
    warehouse: {
      type: String,
      trim: true,
    },
    storageLocation: {
      type: String,
      trim: true,
      uppercase: true,
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      index: "text",
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
      maxlength: [100, "Brand cannot exceed 100 characters"],
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      maxlength: [100, "Sub-category cannot exceed 100 characters"],
    },
    compatibility: {
      type: [compatibilitySchema],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 50;
        },
        message: "Cannot have more than 50 vehicle compatibility entries",
      },
    },
    pricing: {
      type: pricingSchema,
      required: true,
    },
    inventory: {
      type: inventorySchema,
      required: true,
    },
    images: [
      {
        type: String,
        validate: {
          validator: function (v) {
            return /^https?:\/\/.+/.test(v);
          },
          message: "Invalid image URL",
        },
      },
    ],
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vendor ID is required"],
      index: true,
    },
    partNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    manufacturer: {
      type: String,
      trim: true,
      maxlength: [100],
    },
    warrantyMonths: {
      type: Number,
      default: 12,
      min: 0,
      max: 120,
    },
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, default: "cm" },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredReason: { type: String, maxlength: 500 },
    featuredAt: { type: Date },
    featuredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    totalSold: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    metaTitle: {
      type: String,
      maxlength: [60, "Meta title cannot exceed 60 characters"],
    },
    metaDescription: {
      type: String,
      maxlength: [160, "Meta description cannot exceed 160 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

productSchema.index({
  title: "text",
  description: "text",
  brand: "text",
  tags: "text",
});
productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ "pricing.publicPrice": 1 });
productSchema.index({ "pricing.wholesalePrice": 1 });
productSchema.index({ "pricing.publicPrice": 1, "pricing.wholesalePrice": 1 });
productSchema.index({ createdAt: -1 });

productSchema.index({ "compatibility.make": 1 });
productSchema.index({ "compatibility.model": 1 });
productSchema.index({ "compatibility.years": 1 });
productSchema.index({
  "compatibility.make": 1,
  "compatibility.model": 1,
  "compatibility.years": 1,
});
productSchema.index({ category: 1, brand: 1, "pricing.publicPrice": 1 });

productSchema.index({ title: 1, brand: 1, isActive: 1 });
productSchema.index({ isActive: 1, totalSold: -1 });
productSchema.index({ isActive: 1, avgRating: -1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ "inventory.stockQuantity": 1, isActive: 1 });
productSchema.index({ partNumber: 1 }, { sparse: true });

productSchema.pre("save", function (next) {
  if (this.isModified("title") || !this.slug) {
    let slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    this.slug = `${slug}-${Date.now().toString(36)}`;
  }
  next();
});

productSchema.virtual("currentPrice").get(function () {
  if (this.pricing.discountPercent > 0) {
    return (
      Math.round(
        this.pricing.publicPrice *
          (1 - this.pricing.discountPercent / 100) *
          100,
      ) / 100
    );
  }
  return this.pricing.publicPrice;
});

productSchema.virtual("stockStatus").get(function () {
  if (!this.inventory.trackInventory) return "available";
  if (this.inventory.stockQuantity === 0) return "out_of_stock";
  if (this.inventory.stockQuantity <= this.inventory.lowStockThreshold)
    return "low_stock";
  return "in_stock";
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
