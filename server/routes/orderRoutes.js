/**
 * Order Routes - Tracking, Status & Invoicing
 */

const express = require("express");
const router = express.Router();
const OrderController = require("../controllers/OrderController");
const { authenticate } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const { z } = require("zod");

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ]),
    note: z.string().max(500).optional(),
    trackingNumber: z.string().max(100).optional(),
    carrier: z.string().max(100).optional(),
  }),
});

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        errors: error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

router.get("/", authenticate, OrderController.getMyOrders);

router.get(
  "/vendor",
  authenticate,
  authorizeRoles("seller", "garage", "admin"),
  OrderController.getVendorOrders,
);

router.get("/:orderId", authenticate, OrderController.getOrderDetails);

router.get(
  "/:orderId/tracking",
  authenticate,
  OrderController.getOrderTracking,
);

router.patch(
  "/:orderId/status",
  authenticate,
  authorizeRoles("admin", "seller", "garage"),
  validate(updateStatusSchema),
  OrderController.updateOrderStatus,
);

router.get("/:orderId/invoice", authenticate, OrderController.downloadInvoice);

router.post(
  "/:orderId/resend-email",
  authenticate,
  authorizeRoles("admin"),
  OrderController.sendOrderConfirmation,
);

module.exports = router;
