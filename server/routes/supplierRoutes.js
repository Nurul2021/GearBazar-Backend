/**
 * Supplier Routes
 */

const express = require("express");
const router = express.Router();
const SupplierController = require("../controllers/SupplierController");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const { z } = require("zod");

const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    contactPerson: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    paymentTerms: z.enum(["cod", "credit", "prepaid"]).optional(),
  }),
});

const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    contactPerson: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    paymentTerms: z.enum(["cod", "credit", "prepaid"]).optional(),
    isActive: z.boolean().optional(),
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

router.get("/", optionalAuth, SupplierController.getAllSuppliers);

router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "seller"),
  validate(createSupplierSchema),
  SupplierController.createSupplier,
);

router.put(
  "/:supplierId",
  authenticate,
  authorizeRoles("admin"),
  validate(updateSupplierSchema),
  SupplierController.updateSupplier,
);

router.delete(
  "/:supplierId",
  authenticate,
  authorizeRoles("admin"),
  SupplierController.deleteSupplier,
);

module.exports = router;
