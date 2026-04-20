/**
 * Admin Product Control Routes
 */

const express = require('express');
const router = express.Router();
const {
  getAllProductsAdmin,
  toggleFeaturedProduct,
  deleteProductAdmin,
  getProductByIdAdmin
} = require('../controllers/AdminProductController');
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/authorization');

router.use(authenticate);
router.use(authorizeRoles('admin'));

router.get('/products', getAllProductsAdmin);
router.get('/products/:id', getProductByIdAdmin);
router.patch('/products/:id/featured', toggleFeaturedProduct);
router.delete('/products/:id', deleteProductAdmin);

module.exports = router;
