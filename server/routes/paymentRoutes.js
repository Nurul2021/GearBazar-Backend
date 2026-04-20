/**
 * Payment Routes - Checkout and Webhook
 */

const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');

const checkoutSchema = z.object({
  body: z.object({
    orderId: z.string().regex(/^[0-9a-fA-F]{24}$/)
  })
});

const verifySchema = z.object({
  body: z.object({
    transactionId: z.string().min(1),
    orderId: z.string().regex(/^[0-9a-fA-F]{24}$/)
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
  '/checkout',
  authenticate,
  validate(checkoutSchema),
  PaymentController.checkout
);

router.post(
  '/verify',
  authenticate,
  validate(verifySchema),
  PaymentController.verifyPayment
);

router.post(
  '/webhook',
  PaymentController.webhookHandler
);

router.get(
  '/success',
  PaymentController.paymentSuccessRedirect
);

router.get(
  '/fail',
  PaymentController.paymentFailureRedirect
);

router.get(
  '/cancel',
  PaymentController.paymentCancelRedirect
);

module.exports = router;