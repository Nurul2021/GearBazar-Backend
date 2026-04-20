/**
 * Inventory Routes - Vendor Product Management
 */

const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/InventoryController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');
const { z } = require('zod');

const createProductSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000).optional(),
    brand: z.string().min(1).max(100),
    category: z.string().optional(),
    compatibility: z.array(z.object({
      make: z.string(),
      model: z.string(),
      year: z.number(),
      variant: z.string().optional(),
      engine: z.string().optional()
    })).optional(),
    stockQuantity: z.number().int().min(0).default(0),
    publicPrice: z.number().positive(),
    wholesalePrice: z.number().positive(),
    partNumber: z.string().max(50).optional(),
    sku: z.string().max(50).optional(),
    images: z.array(z.object({
      url: z.string().url(),
      alt: z.string().optional(),
      isPrimary: z.boolean().optional()
    })).optional(),
    specifications: z.record(z.string()).optional()
  })
});

const updateStockPriceSchema = z.object({
  body: z.object({
    stockQuantity: z.number().int().min(0).optional(),
    publicPrice: z.number().positive().optional(),
    wholesalePrice: z.number().positive().optional()
  }).refine(data => data.stockQuantity !== undefined || data.publicPrice !== undefined || data.wholesalePrice !== undefined, {
    message: 'At least one field (stockQuantity, publicPrice, or wholesalePrice) is required'
  })
});

const bulkUpdateSchema = z.object({
  body: z.object({
    updates: z.array(z.object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      stockQuantity: z.number().int().min(0).optional(),
      publicPrice: z.number().positive().optional(),
      wholesalePrice: z.number().positive().optional()
    }).refine(data => data.stockQuantity !== undefined || data.publicPrice !== undefined || data.wholesalePrice !== undefined, {
      message: 'Each update must have at least one field to update'
    })).min(1).max(100)
  })
});

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    next(error);
  }
};

router.post(
  '/',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  validate(createProductSchema),
  InventoryController.createProduct
);

router.get(
  '/',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  InventoryController.getMyProducts
);

router.get(
  '/:productId',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  InventoryController.getProductById
);

router.patch(
  '/:productId',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  validate(updateStockPriceSchema),
  InventoryController.updateStockAndPrice
);

router.post(
  '/bulk-update',
  authenticate,
  authorizeRoles('seller', 'admin'),
  validate(bulkUpdateSchema),
  InventoryController.bulkUpdateStock
);

router.delete(
  '/:productId',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  InventoryController.deleteProduct
);

module.exports = router;