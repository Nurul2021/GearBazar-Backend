/**
 * Shop Routes - Vendor Shop Management
 */

const express = require('express');
const router = express.Router();
const ShopController = require('../controllers/ShopController');
const { isOwner } = require('../middleware/shopMiddleware');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');
const { z } = require('zod');

const createShopSchema = z.object({
  body: z.object({
    shopName: z.string().min(3).max(100),
    description: z.string().max(1000).optional(),
    shopAddress: z.object({
      street: z.string().min(1).max(200),
      city: z.string().min(1).max(100),
      state: z.string().min(1).max(100),
      zipCode: z.string().min(1).max(20),
      country: z.string().max(100).optional()
    }),
    contactNumber: z.string().min(1).max(20),
    contactEmail: z.string().email().optional(),
    shopLogo: z.object({
      url: z.string().url(),
      publicId: z.string().optional()
    }).optional(),
    businessRegistration: z.object({
      registrationNumber: z.string().min(1).max(50),
      legalBusinessName: z.string().min(1).max(200),
      businessType: z.enum(['sole_proprietorship', 'partnership', 'llc', 'corporation', 'non_profit']),
      taxId: z.string().max(50).optional(),
      incorporationDate: z.string().optional(),
      issuedAuthority: z.string().max(200).optional(),
      documentUrl: z.string().url().optional()
    }),
    operatingHours: z.object({
      monday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      tuesday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      wednesday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      thursday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      friday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      saturday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      sunday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional()
    }).optional()
  })
});

const updateShopSchema = z.object({
  body: z.object({
    shopName: z.string().min(3).max(100).optional(),
    description: z.string().max(1000).optional(),
    shopAddress: z.object({
      street: z.string().min(1).max(200),
      city: z.string().min(1).max(100),
      state: z.string().min(1).max(100),
      zipCode: z.string().min(1).max(20),
      country: z.string().max(100).optional()
    }).optional(),
    contactNumber: z.string().min(1).max(20).optional(),
    contactEmail: z.string().email().optional(),
    operatingHours: z.object({
      monday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      tuesday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      wednesday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      thursday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      friday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      saturday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional(),
      sunday: z.object({ open: z.string(), close: z.string(), isClosed: z.boolean() }).optional()
    }).optional(),
    socialLinks: z.object({
      website: z.string().url().optional(),
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      twitter: z.string().url().optional()
    }).optional(),
    settings: z.object({
      allowReviews: z.boolean().optional(),
      showContactInfo: z.boolean().optional(),
      autoAcceptOrders: z.boolean().optional()
    }).optional()
  })
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'inactive', 'suspended']),
    reason: z.string().max(500).optional()
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
  authorizeRoles('seller', 'garage'),
  validate(createShopSchema),
  ShopController.createShop
);

router.get(
  '/me',
  authenticate,
  authorizeRoles('seller', 'garage'),
  ShopController.getMyShop
);

router.get(
  '/:shopId',
  authenticate,
  ShopController.getShop
);

router.put(
  '/:shopId',
  authenticate,
  isOwner,
  validate(updateShopSchema),
  ShopController.updateShop
);

router.patch(
  '/:shopId/status',
  authenticate,
  isOwner,
  validate(updateStatusSchema),
  ShopController.updateShopStatus
);

router.delete(
  '/:shopId',
  authenticate,
  isOwner,
  ShopController.deleteShop
);

module.exports = router;