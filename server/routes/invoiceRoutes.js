/**
 * Invoice Routes - PDF Generation & Download
 */

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const InvoiceController = require("../controllers/InvoiceController");

router.get(
  "/download/:orderId",
  requireAuth,
  InvoiceController.downloadInvoice,
);

router.post(
  "/email/:orderId",
  requireAuth,
  InvoiceController.sendInvoiceViaEmail,
);

router.post(
  "/generate/:orderId",
  requireAuth,
  InvoiceController.generateInvoice,
);

router.get("/status/:orderId", requireAuth, InvoiceController.getInvoiceStatus);

module.exports = router;
