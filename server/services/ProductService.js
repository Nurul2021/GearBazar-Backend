/**
 * Product Service - Business Logic Layer
 */

const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

class ProductService {
  async getProductsWithPricing(user, filters = {}, pagination = {}) {
    const { page = 1, limit = 20, sort = '-createdAt' } = pagination;
    const skip = (page - 1) * limit;

    const query = { isActive: true, ...filters };
    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limit),
      Product.countDocuments(query)
    ]);

    const canAccessWholesale = this.canAccessWholesale(user);
    const pricingFn = canAccessWholesale ? 'wholesalePrice' : 'publicPrice';

    const data = products.map(product => ({
      ...product.toObject(),
      displayPrice: product.pricing[pricingFn],
      priceType: canAccessWholesale ? 'wholesale' : 'retail'
    }));

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  canAccessWholesale(user) {
    if (!user) return false;
    const allowedRoles = ['admin', 'seller', 'garage_owner', 'garage'];
    return allowedRoles.includes(user.role) && user.isVerified && user.isActive !== false;
  }

  async getProductById(id, user = null) {
    const product = await Product.findById(id);
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const canAccessWholesale = this.canAccessWholesale(user);
    const isOwner = user && product.sellerId.toString() === user._id?.toString();

    const result = {
      ...product.toObject(),
      displayPrice: canAccessWholesale ? product.pricing.wholesalePrice : product.pricing.publicPrice,
      priceType: canAccessWholesale ? 'wholesale' : 'retail'
    };

    if (!canAccessWholesale) {
      delete result.pricing.costPrice;
    }
    if (!isOwner && user?.role !== 'admin') {
      delete result.pricing.costPrice;
    }

    return result;
  }

  async createProduct(sellerId, data) {
    return Product.create({ ...data, sellerId });
  }

  async updateProduct(id, sellerId, data, userRole) {
    const product = await Product.findById(id);
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    if (userRole !== 'admin' && product.sellerId.toString() !== sellerId.toString()) {
      throw new AppError('Not authorized to update this product', 403, 'FORBIDDEN');
    }

    return Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteProduct(id, sellerId, userRole) {
    const product = await Product.findById(id);
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    if (userRole !== 'admin' && product.sellerId.toString() !== sellerId.toString()) {
      throw new AppError('Not authorized to delete this product', 403, 'FORBIDDEN');
    }

    return Product.findByIdAndDelete(id);
  }
}

module.exports = new ProductService();