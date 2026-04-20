/**
 * Cart Routes - Shopping Cart Endpoints
 */

const express = require('express');
const router = express.Router();
const CartController = require('../controllers/CartController');
const { authenticate } = require('../middleware/auth');
const { z } = require('zod');

const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: z.number().int().min(1).max(999).default(1)
  })
});

const updateQuantitySchema = z.object({
  body: z.object({
    quantity: z.number().int().min(1).max(999)
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
  authenticate,
  CartController.getCart
);

router.post(
  '/',
  authenticate,
  validate(addToCartSchema),
  CartController.addToCart
);

router.put(
  '/items/:productId',
  authenticate,
  validate(updateQuantitySchema),
  CartController.updateCartItem
);

router.delete(
  '/items/:productId',
  authenticate,
  CartController.removeFromCart
);

router.delete(
  '/',
  authenticate,
  CartController.clearCart
);

module.exports = router;