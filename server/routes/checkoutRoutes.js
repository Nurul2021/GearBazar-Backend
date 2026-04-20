/**
 * Checkout Routes - Secure Order Placement
 */

const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/CheckoutController');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');

const placeOrderSchema = z.object({
  body: z.object({
    shippingAddress: z.object({
      fullName: z.string().min(1),
      phone: z.string().min(1),
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      zipCode: z.string().min(1),
      country: z.string().optional()
    }),
    paymentMethod: z.enum(['card', 'bank_transfer', 'cash_on_delivery', 'credit_account']),
    shippingMethod: z.enum(['standard', 'express', 'pickup']).default('standard'),
    customerNote: z.string().max(500).optional()
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
  validate(placeOrderSchema),
  CheckoutController.placeOrder
);

router.post(
  '/recalculate/:orderId',
  authenticate,
  CheckoutController.recalculateOrderTotal
);

module.exports = router;