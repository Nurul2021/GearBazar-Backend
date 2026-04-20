/**
 * Order Model - Multi-vendor E-commerce Order
 */

const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    brand: { type: String },
    partNumber: { type: String },
    image: { type: String },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    priceType: {
      type: String,
      enum: ["retail", "wholesale"],
      default: "retail",
    },
    subtotal: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    trackingNumber: { type: String },
    carrier: { type: String },
    deliveredAt: { type: Date },
  },
  { _id: true },
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: "USA" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderItems: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "Order must have at least one item",
      },
    },
    vendorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    shippingMethod: {
      type: String,
      enum: ["standard", "express", "pickup"],
      default: "standard",
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    estimatedDelivery: { type: Date },
    paymentMethod: {
      type: String,
      enum: ["card", "bank_transfer", "cash_on_delivery", "credit_account"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "authorized", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    paymentTransactionId: { type: String },
    paidAt: { type: Date },
    taxPrice: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    customerNote: { type: String },
    internalNote: { type: String },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: { type: String },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    confirmedAt: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String },
    commissionPercentage: { type: Number, default: 10 },
    commissionAmount: { type: Number, default: 0 },
    platformEarnings: { type: Number, default: 0 },
    vendorEarnings: { type: Number, default: 0 },
    invoiceUrl: { type: String },
    invoicePublicId: { type: String },
    invoiceGeneratedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `GB-${timestamp}-${random}`;
  }

  const uniqueVendorIds = [
    ...new Set(this.orderItems.map((item) => item.vendorId.toString())),
  ];
  this.vendorIds = uniqueVendorIds.map((id) => new mongoose.Types.ObjectId(id));

  next();
});

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ vendorIds: 1, orderStatus: 1 });
orderSchema.index({ "orderItems.vendorId": 1 });

orderSchema.virtual("itemCount").get(function () {
  return this.orderItems.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
