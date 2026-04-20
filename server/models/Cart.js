/**
 * Cart Model - Shopping Cart for Auto-parts Marketplace
 */

const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      max: [999, "Quantity cannot exceed 999"],
    },
    selectedPrice: {
      type: Number,
      required: true,
    },
    priceType: {
      type: String,
      enum: ["retail", "wholesale"],
      default: "retail",
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 100;
        },
        message: "Cart cannot have more than 100 items",
      },
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    estimatedSavings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

cartSchema.methods.calculateTotals = function () {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);

  this.subtotal = this.items.reduce((sum, item) => {
    return sum + item.selectedPrice * item.quantity;
  }, 0);

  this.subtotal = Math.round(this.subtotal * 100) / 100;
};

cartSchema.virtual("itemCount").get(function () {
  return this.items.length;
});

cartSchema.set("toJSON", { virtuals: true });
cartSchema.set("toObject", { virtuals: true });

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
