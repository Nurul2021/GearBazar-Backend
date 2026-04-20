/**
 * Invoice Controller - PDF Generation, Download & Email
 */

const InvoiceService = require("../services/InvoiceService");
const Order = require("../models/Order");
const { AppError } = require("../middleware/errorHandler");

const downloadInvoice = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const query = { _id: orderId };
    if (userRole === "customer") {
      query.customer = userId;
    }

    const order = await Order.findOne(query)
      .populate("customer", "name email")
      .populate("orderItems.vendorId", "name shopName")
      .lean();

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    await InvoiceService.streamInvoiceToResponse(order, res);
  } catch (error) {
    next(error);
  }
};

const sendInvoiceViaEmail = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { email } = req.body;
    const userId = req.userId;
    const userRole = req.userRole;

    const query = { _id: orderId };
    if (userRole === "customer") {
      query.customer = userId;
    }

    const order = await Order.findOne(query)
      .populate("customer", "name email")
      .lean();

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const recipientEmail = email || order.customer.email;
    const recipientName = order.customer.name || "Customer";

    const result = await InvoiceService.sendInvoiceEmail(
      order,
      recipientEmail,
      recipientName,
    );

    if (!result.success) {
      throw new AppError("Failed to send invoice email", 500, "EMAIL_FAILED");
    }

    res.status(200).json({
      success: true,
      message: `Invoice sent to ${recipientEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

const generateInvoice = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const query = { _id: orderId };
    if (userRole === "customer") {
      query.customer = userId;
    }

    const order = await Order.findOne(query)
      .populate("customer", "name email")
      .populate("orderItems.vendorId", "name shopName")
      .lean();

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    const result = await InvoiceService.generateAndSaveInvoice(order);

    res.status(200).json({
      success: true,
      message: "Invoice generated and saved",
      data: {
        invoiceUrl: order.invoiceUrl,
        generatedAt: order.invoiceGeneratedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getInvoiceStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;

    const query = { _id: orderId };
    if (userRole === "customer") {
      query.customer = userId;
    }

    const order = await Order.findOne(query)
      .select("invoiceUrl invoicePublicId invoiceGeneratedAt orderNumber")
      .lean();

    if (!order) {
      throw new AppError("Order not found", 404, "NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        hasInvoice: !!order.invoiceUrl,
        invoiceUrl: order.invoiceUrl,
        generatedAt: order.invoiceGeneratedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  downloadInvoice,
  sendInvoiceViaEmail,
  generateInvoice,
  getInvoiceStatus,
};
