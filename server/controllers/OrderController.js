/**
 * Order Controller - Tracking & Invoicing
 */

const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const Order = require("../models/Order");
const Product = require("../models/Product");
const InvoiceService = require("../services/InvoiceService");
const FinanceSettings = require("../models/FinanceSettings");
const { AppError } = require("../middleware/errorHandler");

const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status, sort = "newest" } = req.query;

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = parseInt(limit) > 0 ? Math.min(parseInt(limit), 100) : 20;
    const skip = (pageNum - 1) * limitNum;

    const query = { customer: userId };
    if (status) {
      query.orderStatus = status;
    }

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "price_high") sortOption = { totalPrice: -1 };
    if (sort === "price_low") sortOption = { totalPrice: 1 };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select("-statusHistory -internalNote")
        .populate("orderItems.product", "title images")
        .lean(),
      Order.countDocuments(query),
    ]);

    const statusCounts = await Order.aggregate([
      { $match: { customer: userId } },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]);

    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: orders,
      statusSummary,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getVendorOrders = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status, sort = "newest" } = req.query;

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = parseInt(limit) > 0 ? Math.min(parseInt(limit), 100) : 20;
    const skip = (pageNum - 1) * limitNum;

    const query = { "orderItems.vendorId": userId };
    if (status) {
      query.orderStatus = status;
    }

    let sortOption = { createdAt: -1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    if (sort === "price_high") sortOption = { totalPrice: -1 };
    if (sort === "price_low") sortOption = { totalPrice: 1 };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select("-statusHistory -internalNote")
        .populate("customer", "name email phone")
        .populate("orderItems.product", "title images partNumber")
        .populate("orderItems.vendorId", "name shopName")
        .lean(),
      Order.countDocuments(query),
    ]);

    const vendorOrders = orders.map((order) => {
      const vendorItems = order.orderItems.filter(
        (item) =>
          item.vendorId && item.vendorId.toString() === userId.toString(),
      );
      const vendorTotal = vendorItems.reduce(
        (sum, item) => sum + (item.subtotal || item.price * item.quantity),
        0,
      );

      return {
        ...order,
        vendorItems,
        vendorTotal,
        items: vendorItems,
      };
    });

    const statusCounts = await Order.aggregate([
      { $match: { "orderItems.vendorId": userId } },
      { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
    ]);

    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: vendorOrders,
      orders: vendorOrders,
      statusSummary,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getOrderDetails = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { orderId } = req.params;

    let order;
    if (userRole === "admin") {
      order = await Order.findById(orderId)
        .populate("customer", "name email phone")
        .populate("orderItems.product", "title images partNumber")
        .populate("orderItems.vendorId", "name shopName email");
    } else {
      order = await Order.findOne({ _id: orderId, customer: userId })
        .populate("orderItems.product", "title images partNumber")
        .populate("orderItems.vendorId", "name shopName");
    }

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

const getOrderTracking = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { orderId } = req.params;

    const result = await InvoiceService.getOrderTrackingInfo(
      orderId,
      userId,
      userRole,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { orderId } = req.params;
    const { status, note, trackingNumber, carrier } = req.body;

    const validCustomerStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
    ];
    const validVendorStatuses = ["processing", "shipped"];
    const validAdminStatuses = [
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    let allowedStatuses;
    if (userRole === "admin") allowedStatuses = validAdminStatuses;
    else if (["seller", "garage"].includes(userRole))
      allowedStatuses = validVendorStatuses;
    else allowedStatuses = [];

    if (!allowedStatuses.includes(status)) {
      throw new AppError(
        `Invalid status for your role. Allowed: ${allowedStatuses.join(", ")}`,
        400,
        "INVALID_STATUS",
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    if (userRole === "customer") {
      throw new AppError(
        "Customers cannot update order status",
        403,
        "FORBIDDEN",
      );
    }

    if (userRole !== "admin") {
      const hasVendorItems = order.orderItems.some(
        (item) => item.vendorId.toString() === userId,
      );
      if (!hasVendorItems) {
        throw new AppError(
          "You do not have items in this order",
          403,
          "FORBIDDEN",
        );
      }
    }

    const statusTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    const currentStatus = order.orderStatus;
    const allowedTransitions = statusTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      throw new AppError(
        `Cannot transition from ${currentStatus} to ${status}`,
        400,
        "INVALID_TRANSITION",
      );
    }

    order.orderStatus = status;
    order.statusHistory.push({
      status,
      note: note || `Status updated to ${status} by ${userRole}`,
      updatedBy: userId,
      timestamp: new Date(),
    });

    if (status === "confirmed") {
      order.confirmedAt = new Date();
    } else if (status === "shipped") {
      order.shippedAt = new Date();
      if (trackingNumber) {
        order.orderItems.forEach((item) => {
          if (!item.trackingNumber) {
            item.trackingNumber = trackingNumber;
            item.carrier = carrier;
          }
        });
      }
    } else if (status === "delivered") {
      order.deliveredAt = new Date();
      order.paymentStatus = "paid";

      const settings = await FinanceSettings.findOne();
      const commissionRate = (settings?.commissionPercentage || 10) / 100;

      let totalCommission = 0;
      let totalVendorEarnings = 0;

      for (const item of order.orderItems) {
        const itemCommission = item.subtotal * commissionRate;
        const itemVendorEarnings = item.subtotal - itemCommission;
        totalCommission += itemCommission;
        totalVendorEarnings += itemVendorEarnings;
      }

      order.commissionPercentage = settings?.commissionPercentage || 10;
      order.commissionAmount = Math.round(totalCommission * 100) / 100;
      order.platformEarnings = Math.round(totalCommission * 100) / 100;
      order.vendorEarnings = Math.round(totalVendorEarnings * 100) / 100;
    }

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const { orderId } = req.params;

    const query =
      userRole === "admin"
        ? { _id: orderId }
        : { _id: orderId, customer: userId };

    const order = await Order.findOne(query)
      .populate("customer", "name email")
      .populate("orderItems.product", "title partNumber")
      .populate("orderItems.vendorId", "name shopName");

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const invoiceDir = path.join(__dirname, "../../temp/invoices");
    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir, { recursive: true });
    }

    const invoicePath = path.join(
      invoiceDir,
      `invoice-${order.orderNumber}.pdf`,
    );
    await InvoiceService.generateInvoicePDF(order, invoicePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderNumber}.pdf`,
    );

    const fileStream = fs.createReadStream(invoicePath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      fs.unlinkSync(invoicePath);
    });
  } catch (error) {
    next(error);
  }
};

const sendOrderConfirmation = async (req, res, next) => {
  try {
    const userRole = req.userRole;
    const { orderId } = req.params;

    if (userRole !== "admin") {
      throw new AppError(
        "Only admin can resend order confirmation",
        403,
        "FORBIDDEN",
      );
    }

    const order = await Order.findById(orderId).populate(
      "customer",
      "name email",
    );
    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const emailSent = await InvoiceService.sendOrderConfirmationEmail(order);

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: "Order confirmation email sent successfully",
      });
    } else {
      throw new AppError("Failed to send email", 500, "EMAIL_FAILED");
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyOrders,
  getVendorOrders,
  getOrderDetails,
  getOrderTracking,
  updateOrderStatus,
  downloadInvoice,
  sendOrderConfirmation,
};
