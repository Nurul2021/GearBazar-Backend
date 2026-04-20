/**
 * Brand Routes
 */

const express = require("express");
const router = express.Router();
const BrandController = require("../controllers/BrandController");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { authorizeRoles } = require("../middleware/authorization");
const { z } = require("zod");

const createBrandSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    logo: z
      .object({
        url: z.string().url(),
        publicId: z.string().optional(),
      })
      .optional(),
  }),
});

const updateBrandSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    logo: z
      .object({
        url: z.string().url(),
        publicId: z.string().optional(),
      })
      .optional(),
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

router.get("/", optionalAuth, BrandController.getAllBrands);

router.post(
  "/",
  authenticate,
  authorizeRoles("admin", "seller"),
  validate(createBrandSchema),
  BrandController.createBrand,
);

router.put(
  "/:brandId",
  authenticate,
  authorizeRoles("admin"),
  validate(updateBrandSchema),
  BrandController.updateBrand,
);

router.delete(
  "/:brandId",
  authenticate,
  authorizeRoles("admin"),
  BrandController.deleteBrand,
);

module.exports = router;
