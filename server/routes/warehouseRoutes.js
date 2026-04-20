/**
 * Warehouse Routes
 */

const express = require("express");
const router = express.Router();
const WarehouseController = require("../controllers/WarehouseController");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const { z } = require("zod");

const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    location: z
      .object({
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        division: z.string().optional(),
      })
      .optional(),
    capacity: z.number().int().min(0).optional(),
  }),
});

const updateWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    location: z
      .object({
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        division: z.string().optional(),
      })
      .optional(),
    capacity: z.number().int().min(0).optional(),
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

router.get("/", optionalAuth, WarehouseController.getAllWarehouses);

router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "seller"),
  validate(createWarehouseSchema),
  WarehouseController.createWarehouse,
);

router.put(
  "/:warehouseId",
  authenticate,
  authorizeRoles("admin"),
  validate(updateWarehouseSchema),
  WarehouseController.updateWarehouse,
);

router.delete(
  "/:warehouseId",
  authenticate,
  authorizeRoles("admin"),
  WarehouseController.deleteWarehouse,
);

module.exports = router;
