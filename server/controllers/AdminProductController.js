/**
 * Admin Product Control Controller
 */

const Product = require('../models/Product');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { sendEmail } = require('../utils/email/emailService');
const { getProductDeletionEmailTemplate } = require('../utils/email/templates');

const getAllProductsAdmin = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      brand,
      vendor,
      isActive,
      isFeatured,
      minPrice,
      maxPrice,
      stockStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { partNumber: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (vendor) query.vendorId = vendor;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';

    if (minPrice || maxPrice) {
      query['pricing.publicPrice'] = {};
      if (minPrice) query['pricing.publicPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.publicPrice'].$lte = parseFloat(maxPrice);
    }

    if (stockStatus) {
      if (stockStatus === 'inStock') query['inventory.stockQuantity'] = { $gt: 0 };
      if (stockStatus === 'lowStock') query['inventory.stockQuantity'] = { $gt: 0, $lte: 5 };
      if (stockStatus === 'outOfStock') query['inventory.stockQuantity'] = 0;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('vendorId', 'name email shopDetails')
        .populate('category', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(query)
    ]);

    const stats = await Product.aggregate([
      { $group: { _id: '$isActive', count: { $sum: 1 } } }
    ]);

    const stockStats = await Product.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $gt: ['$inventory.stockQuantity', 5] },
              'inStock',
              {
                $cond: [
                  { $gt: ['$inventory.stockQuantity', 0] },
                  'lowStock',
                  'outOfStock'
                ]
              }
            ]
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          active: stats.find(s => s._id === true)?.count || 0,
          inactive: stats.find(s => s._id === false)?.count || 0,
          inStock: stockStats.find(s => s._id === 'inStock')?.count || 0,
          lowStock: stockStats.find(s => s._id === 'lowStock')?.count || 0,
          outOfStock: stockStats.find(s => s._id === 'outOfStock')?.count || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const toggleFeaturedProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isFeatured, featuredReason } = req.body;

    const product = await Product.findById(id).populate('vendorId', 'name email');

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const previousStatus = product.isFeatured;
    product.isFeatured = isFeatured !== undefined ? isFeatured : !previousStatus;
    product.featuredReason = featuredReason || (product.isFeatured ? 'Featured by admin' : null);
    product.featuredAt = product.isFeatured ? new Date() : null;
    product.featuredBy = product.isFeatured ? req.userId : null;

    await product.save();

    res.status(200).json({
      success: true,
      message: product.isFeatured ? 'Product featured successfully' : 'Product unfeatured successfully',
      data: {
        productId: product._id,
        title: product.title,
        isFeatured: product.isFeatured,
        featuredAt: product.featuredAt
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteProductAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      throw new AppError('Deletion reason is required (min 10 characters)', 400, 'REASON_REQUIRED');
    }

    const product = await Product.findById(id).populate('vendorId', 'name email');

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const vendorEmail = product.vendorId?.email;
    const vendorName = product.vendorId?.name || 'Vendor';
    const productTitle = product.title;
    const productId = product._id;

    await Product.findByIdAndDelete(id);

    if (vendorEmail) {
      const emailHtml = getProductDeletionEmailTemplate({
        vendorName,
        productTitle,
        productId: productId.toString(),
        reason: reason.trim(),
        deletedAt: new Date().toISOString()
      });

      await sendEmail(
        vendorEmail,
        'Product Removed - GearBazar',
        emailHtml
      );
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {
        productId,
        productTitle,
        vendorNotified: !!vendorEmail,
        deletedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

const getProductByIdAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('vendorId', 'name email phone shopDetails isVerified')
      .populate('category', 'name slug')
      .lean();

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const orderCount = await require('../models/Order').countDocuments({
      'items.product': id,
      status: { $nin: ['cancelled'] }
    });

    const reviewStats = await require('../models/Review').aggregate([
      { $match: { product: product._id, isApproved: true } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...product,
        orderCount,
        reviewStats: reviewStats[0] || { avgRating: 0, totalReviews: 0 }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProductsAdmin,
  toggleFeaturedProduct,
  deleteProductAdmin,
  getProductByIdAdmin
};
