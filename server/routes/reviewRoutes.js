/**
 * Review Routes - All Review Endpoints including Moderation
 */

const express = require('express');
const router = express.Router();
const ReviewController = require('../controllers/ReviewController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');
const { z } = require('zod');

const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    vendorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vendor ID'),
    orderId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    rating: z.number().int().min(1).max(5),
    title: z.string().max(200).optional(),
    comment: z.string().max(2000).optional(),
    images: z.array(z.string().url()).max(10).optional(),
    pros: z.array(z.string().max(100)).max(5).optional(),
    cons: z.array(z.string().max(100)).max(5).optional()
  })
});

const respondSchema = z.object({
  body: z.object({
    response: z.string().min(1).max(1000)
  })
});

const reportSchema = z.object({
  body: z.object({
    reason: z.enum(['fake_information', 'inappropriate_content', 'spam', 'misleading', 'other']),
    details: z.string().max(500).optional()
  })
});

const adminActionSchema = z.object({
  body: z.object({
    action: z.enum(['hide', 'show']),
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

router.get(
  '/product/:productId',
  optionalAuth,
  ReviewController.getProductReviews
);

router.get(
  '/vendor/:vendorId',
  optionalAuth,
  ReviewController.getVendorRatings
);

router.get(
  '/my-reviews',
  authenticate,
  ReviewController.getUserReviews
);

router.post(
  '/',
  authenticate,
  validate(createReviewSchema),
  ReviewController.createReview
);

router.post(
  '/:reviewId/helpful',
  authenticate,
  ReviewController.markHelpful
);

router.post(
  '/:reviewId/respond',
  authenticate,
  authorizeRoles('seller', 'garage', 'admin'),
  validate(respondSchema),
  ReviewController.vendorRespondToReview
);

router.post(
  '/:reviewId/report',
  authenticate,
  validate(reportSchema),
  ReviewController.reportReview
);

router.delete(
  '/:reviewId',
  authenticate,
  ReviewController.deleteOwnReview
);

router.delete(
  '/:reviewId/admin',
  authenticate,
  authorizeRoles('admin'),
  ReviewController.adminDeleteReview
);

router.patch(
  '/:reviewId/status',
  authenticate,
  authorizeRoles('admin'),
  validate(adminActionSchema),
  ReviewController.adminHideReview
);

module.exports = router;