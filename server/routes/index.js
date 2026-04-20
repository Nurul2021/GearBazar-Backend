/**
 * Main Routes - Combines all module routes
 */

const express = require("express");
const router = express.Router();

const productRoutes = require("./productRoutes");
const authRoutes = require("./authRoutes");
const verificationRoutes = require("./verificationRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const shopRoutes = require("./shopRoutes");
const inventoryRoutes = require("./inventoryRoutes");
const orderRoutes = require("./orderRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const categoryRoutes = require("./categoryRoutes");
const cartRoutes = require("./cartRoutes");
const paymentRoutes = require("./paymentRoutes");
const checkoutRoutes = require("./checkoutRoutes");
const reviewRoutes = require("./reviewRoutes");
const userManagementRoutes = require("./userManagementRoutes");
const adminProductRoutes = require("./adminProductRoutes");
const financeRoutes = require("./financeRoutes");
const settingsRoutes = require("./settingsRoutes");
const systemLogRoutes = require("./systemLogRoutes");
const searchRoutes = require("./searchRoutes");
const invoiceRoutes = require("./invoiceRoutes");
const notificationRoutes = require("./notificationRoutes");
const brandRoutes = require("./brandRoutes");
const warehouseRoutes = require("./warehouseRoutes");
const supplierRoutes = require("./supplierRoutes");
const adminAnalyticsRoutes = require("./adminAnalyticsRoutes");
const adminOrdersRoutes = require("./adminOrdersRoutes");

router.use("/products", productRoutes);
router.use("/auth", authRoutes);
router.use("/verification", verificationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/shops", shopRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/orders", orderRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/categories", categoryRoutes);
router.use("/cart", cartRoutes);
router.use("/payments", paymentRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin", userManagementRoutes);
router.use("/admin", adminProductRoutes);
router.use("/admin", adminAnalyticsRoutes);
router.use("/admin", adminOrdersRoutes);
router.use("/finance", financeRoutes);
router.use("/settings", settingsRoutes);
router.use("/admin/logs", systemLogRoutes);
router.use("/search", searchRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/notifications", notificationRoutes);
router.use("/categories/brands", brandRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/suppliers", supplierRoutes);

router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
