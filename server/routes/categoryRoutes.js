/**
 * Category Routes - Admin & Public Endpoints
 */

const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');
const { z } = require('zod');

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    icon: z.string().max(100).optional(),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().optional()
    }).optional(),
    parentCategory: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
    displayOrder: z.number().int().default(0),
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional()
  })
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    icon: z.string().max(100).optional(),
    image: z.object({
      url: z.string().url(),
      publicId: z.string().optional()
    }).optional(),
    parentCategory: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional()
  })
});

const toggleFeaturedSchema = z.object({
  body: z.object({
    isFeatured: z.boolean()
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

router.get(
  '/',
  optionalAuth,
  CategoryController.getAllCategories
);

router.get(
  '/brands',
  optionalAuth,
  CategoryController.getAllBrands
);

router.get(
  '/featured',
  optionalAuth,
  CategoryController.getFeaturedProducts
);

router.get(
  '/:categoryId',
  optionalAuth,
  CategoryController.getCategoryById
);

router.post(
  '/',
  authenticate,
  authorizeRoles('admin'),
  validate(createCategorySchema),
  CategoryController.createCategory
);

router.put(
  '/:categoryId',
  authenticate,
  authorizeRoles('admin'),
  validate(updateCategorySchema),
  CategoryController.updateCategory
);

router.delete(
  '/:categoryId',
  authenticate,
  authorizeRoles('admin'),
  CategoryController.deleteCategory
);

router.patch(
  '/:productId/featured',
  authenticate,
  authorizeRoles('admin'),
  validate(toggleFeaturedSchema),
  CategoryController.toggleFeaturedProduct
);

module.exports = router;