/**
 * Admin Orders Routes
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const Order = require("../models/Order");

router.get(
  "/orders",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        dateFrom,
        dateTo,
      } = req.query;

      const query = {};

      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: "i" } },
          { "customer.name": { $regex: search, $options: "i" } },
          { "customer.email": { $regex: search, $options: "i" } },
        ];
      }

      if (status) query.status = status;

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Order.countDocuments(query),
      ]);

      res.status(200).json({
        success: true,
        data: {
          orders: orders.map((order) => ({
            _id: order._id,
            orderNumber: order.orderNumber || order._id.toString(),
            customer: order.customer || { name: "Guest", email: "N/A" },
            items: order.items?.length || 0,
            total: order.total || 0,
            status: order.status || "pending",
            paymentMethod: order.paymentMethod || "N/A",
            createdAt: order.createdAt,
          })),
          total,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

module.exports = router;
