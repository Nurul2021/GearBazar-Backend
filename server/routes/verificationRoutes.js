/**
 * Verification Routes - Admin & Vendor
 */

const express = require("express");
const router = express.Router();
const VerificationController = require("../controllers/VerificationController");
const { authenticate } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const { otpLimiter, registerLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/upload");
const { z } = require("zod");

const rejectUserSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(1, "Rejection reason is required")
      .max(500, "Reason cannot exceed 500 characters"),
  }),
});

const rejectDocumentSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(1, "Rejection reason is required")
      .max(500, "Reason cannot exceed 500 characters"),
  }),
});

const validateRejectUser = (req, res, next) => {
  try {
    rejectUserSchema.parse(req.body);
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

const validateRejectDocument = (req, res, next) => {
  try {
    rejectDocumentSchema.parse(req.body);
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

// Vendor routes - get/upload documents
router.get(
  "/documents",
  authenticate,
  authorizeRoles("seller", "garage", "shop"),
  VerificationController.getMyDocuments,
);

router.post(
  "/documents",
  authenticate,
  authorizeRoles("seller", "garage", "shop"),
  upload.single("document"),
  VerificationController.uploadDocument,
);

// Admin routes - review documents
router.get(
  "/pending",
  authenticate,
  authorizeRoles("admin"),
  VerificationController.getAllPendingVerifications,
);

router.patch(
  "/documents/:documentId/approve",
  authenticate,
  authorizeRoles("admin"),
  VerificationController.approveDocument,
);

router.post(
  "/documents/:documentId/reject",
  authenticate,
  authorizeRoles("admin"),
  validateRejectDocument,
  VerificationController.rejectDocument,
);

router.patch(
  "/:userId/approve",
  authenticate,
  authorizeRoles("admin"),
  VerificationController.approveUser,
);

router.post(
  "/:userId/reject",
  authenticate,
  authorizeRoles("admin"),
  validateRejectUser,
  VerificationController.rejectUser,
);

module.exports = router;
