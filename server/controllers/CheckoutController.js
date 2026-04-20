/**
 * Secure Checkout Controller - Final Price Validation
 */

const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const User = require("../models/User");
const FinanceSettings = require("../models/FinanceSettings");
const { getPriceForUser } = require("../utils/priceCalculator");
const InvoiceService = require("../services/InvoiceService");
const { AppError } = require("../middleware/errorHandler");

const TAX_RATE = 0.08;

const canAccessWholesalePricing = (user) => {
  if (!user) return false;
  return (
    ["seller", "garage", "admin"].includes(user.role) &&
    user.isVerified === true &&
    user.isActive !== false
  );
};

const validateAndCalculatePrices = (cartItems, user) => {
  const validatedItems = [];
  let calculatedSubtotal = 0;

  for (const cartItem of cartItems) {
    const product = cartItem.product;
    const requestedQty = cartItem.quantity;
    const requestedPrice = cartItem.selectedPrice;

    if (!product || !product.isActive) {
      throw new AppError(
        `Product "${product?.title || "Unknown"}" is no longer available`,
        400,
        "PRODUCT_UNAVAILABLE",
      );
    }

    if (product.inventory.trackInventory) {
      const availableStock = product.inventory.stockQuantity;
      const maxAllowed = product.inventory.allowBackorder
        ? availableStock + 100
        : availableStock;

      if (requestedQty > maxAllowed) {
        throw new AppError(
          `Insufficient stock for "${product.title}". Available: ${availableStock}`,
          400,
          "INSUFFICIENT_STOCK",
        );
      }
    }

    const priceInfo = getPriceForUser(product, user);
    const currentUnitPrice = priceInfo.finalPrice;
    const currentPriceType = priceInfo.priceType;

    if (Math.abs(currentUnitPrice - requestedPrice) > 0.01) {
      throw new AppError(
        `Price mismatch for "${product.title}". Expected: $${currentUnitPrice}, Received: $${requestedPrice}. Please refresh your cart.`,
        400,
        "PRICE_MISMATCH",
      );
    }

    if (currentPriceType !== cartItem.priceType) {
      throw new AppError(
        `Price type changed for "${product.title}". Your cart may be outdated.`,
        400,
        "PRICE_TYPE_CHANGED",
      );
    }

    const itemSubtotal = currentUnitPrice * requestedQty;
    calculatedSubtotal += itemSubtotal;

    validatedItems.push({
      product: product._id,
      vendorId: product.vendorId,
      title: product.title,
      brand: product.brand,
      partNumber: product.partNumber,
      image: product.images?.[0] || null,
      quantity: requestedQty,
      unitPrice: currentUnitPrice,
      priceType: currentPriceType,
      subtotal: Math.round(itemSubtotal * 100) / 100,
      status: "pending",
    });
  }

  return {
    items: validatedItems,
    subtotal: Math.round(calculatedSubtotal * 100) / 100,
  };
};

const placeOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const user = req.user;
    const {
      shippingAddress,
      paymentMethod,
      shippingMethod = "standard",
      customerNote,
    } = req.body;

    if (!shippingAddress || !paymentMethod) {
      throw new AppError(
        "Shipping address and payment method are required",
        400,
        "VALIDATION_ERROR",
      );
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      select:
        "title brand partNumber images pricing inventory vendorId isActive",
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }

    const { items: validatedItems, subtotal } = validateAndCalculatePrices(
      cart.items,
      user,
    );

    const shippingCosts = { standard: 9.99, express: 19.99, pickup: 0 };
    const shippingPrice = shippingCosts[shippingMethod] || 9.99;
    const taxPrice = Math.round(subtotal * TAX_RATE * 100) / 100;
    const totalPrice =
      Math.round((subtotal + shippingPrice + taxPrice) * 100) / 100;

    const settings = await FinanceSettings.findOne();
    const commissionPercentage = settings?.commissionPercentage || 10;
    const commissionRate = commissionPercentage / 100;
    const commissionAmount = Math.round(subtotal * commissionRate * 100) / 100;
    const platformEarnings = commissionAmount;
    const vendorEarnings =
      Math.round((subtotal - commissionAmount) * 100) / 100;

    const order = new Order({
      customer: userId,
      orderItems: validatedItems,
      shippingAddress,
      shippingMethod,
      shippingPrice,
      paymentMethod,
      taxPrice,
      subtotal,
      totalPrice,
      currency: "USD",
      customerNote,
      orderStatus: "pending",
      paymentStatus: "pending",
      commissionPercentage,
      commissionAmount,
      platformEarnings,
      vendorEarnings,
      statusHistory: [
        {
          status: "pending",
          note: "Order placed - price validated",
          updatedBy: userId,
          timestamp: new Date(),
        },
      ],
    });

    await order.save({ session });

    for (const item of validatedItems) {
      if (item.unitPrice > 0) {
        await Product.findByIdAndUpdate(
          item.product,
          {
            $inc: {
              "inventory.stockQuantity": -item.quantity,
              totalSold: item.quantity,
            },
          },
          { session },
        );
      }
    }

    await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], totalItems: 0, subtotal: 0 },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    await order.populate([
      { path: "orderItems.product", select: "title slug" },
      { path: "orderItems.vendorId", select: "name shopName" },
    ]);

    const populatedUser = await User.findById(userId);
    await InvoiceService.sendOrderConfirmationEmail(populatedUser);

    res.status(201).json({
      success: true,
      message: "Order placed successfully with validated pricing",
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          orderItems: order.orderItems,
          subtotal: order.subtotal,
          shippingPrice: order.shippingPrice,
          taxPrice: order.taxPrice,
          totalPrice: order.totalPrice,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
        },
        validation: {
          pricesValidated: true,
          priceType: canAccessWholesalePricing(user) ? "wholesale" : "retail",
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

const recalculateOrderTotal = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const user = req.user;

    const order = await Order.findOne({ _id: orderId, customer: userId });
    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    if (order.paymentStatus === "paid") {
      throw new AppError("Cannot recalculate paid order", 400, "INVALID_STATE");
    }

    const productIds = order.orderItems.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let newSubtotal = 0;
    const updatedItems = order.orderItems.map((item) => {
      const product = productMap.get(item.product.toString());
      if (!product) {
        throw new AppError(
          `Product not found: ${item.product}`,
          404,
          "PRODUCT_NOT_FOUND",
        );
      }

      const priceInfo = getPriceForUser(product, user);
      const newSubtotal = priceInfo.finalPrice * item.quantity;

      return {
        ...item.toObject(),
        unitPrice: priceInfo.finalPrice,
        priceType: priceInfo.priceType,
        subtotal: Math.round(newSubtotal * 100) / 100,
      };
    });

    newSubtotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const shippingPrice = order.shippingPrice;
    const taxPrice = Math.round(newSubtotal * TAX_RATE * 100) / 100;
    const newTotal =
      Math.round((newSubtotal + shippingPrice + taxPrice) * 100) / 100;

    order.orderItems = updatedItems;
    order.subtotal = newSubtotal;
    order.taxPrice = taxPrice;
    order.totalPrice = newTotal;
    order.statusHistory.push({
      status: "price_recalculated",
      note: "Prices recalculated based on current user status",
      updatedBy: userId,
      timestamp: new Date(),
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order total recalculated",
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          subtotal: order.subtotal,
          taxPrice: order.taxPrice,
          shippingPrice: order.shippingPrice,
          totalPrice: order.totalPrice,
        },
        recalculation: {
          previousTotal: order.totalPrice,
          newTotal: newTotal,
          difference: Math.round((newTotal - order.totalPrice) * 100) / 100,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  placeOrder,
  recalculateOrderTotal,
  validateAndCalculatePrices,
};
