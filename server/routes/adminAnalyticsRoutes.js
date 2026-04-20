/**
 * Admin Analytics Routes
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

router.get(
  "/admin-analytics",
  authenticate,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const [
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenueResult,
        recentOrders,
      ] = await Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
        Order.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate("userId", "name email")
          .lean(),
      ]);

      const totalRevenue = totalRevenueResult[0]?.total || 0;

      res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          recentOrders: recentOrders.map((order) => ({
            _id: order._id,
            orderNumber: order.orderNumber || order._id.toString(),
            customer: order.userId
              ? {
                  name: order.userId.name,
                  email: order.userId.email,
                }
              : { name: "Guest", email: "N/A" },
            total: order.total,
            status: order.status || "pending",
            createdAt: order.createdAt,
          })),
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
