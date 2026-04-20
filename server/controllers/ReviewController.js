/**
 * Review Controller - Get All Reviews & Vendor Ratings
 */

const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

const createReview = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { 
      productId, 
      vendorId, 
      orderId,
      rating, 
      title, 
      comment, 
      images,
      pros,
      cons 
    } = req.body;

    if (!productId || !vendorId) {
      throw new AppError('Product ID and Vendor ID are required', 400, 'VALIDATION_ERROR');
    }

    if (!rating || rating < 1 || rating > 5) {
      throw new AppError('Rating is required and must be between 1 and 5', 400, 'VALIDATION_ERROR');
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const existingReview = await Review.findOne({
      user: userId,
      product: productId
    });

    if (existingReview) {
      throw new AppError('You have already reviewed this product', 400, 'DUPLICATE_REVIEW');
    }

    let isVerifiedPurchase = false;
    
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        customer: userId,
        orderStatus: 'delivered',
        paymentStatus: 'paid'
      });

      if (!order) {
        throw new AppError('Invalid order or order not completed', 400, 'INVALID_ORDER');
      }

      const hasProduct = order.orderItems.some(
        item => item.product.toString() === productId
      );

      if (!hasProduct) {
        throw new AppError('This order does not contain the specified product', 400, 'PRODUCT_NOT_IN_ORDER');
      }

      isVerifiedPurchase = true;
    } else {
      const completedOrder = await Order.findOne({
        customer: userId,
        'orderItems.product': productId,
        orderStatus: 'delivered',
        paymentStatus: 'paid'
      });

      if (!completedOrder) {
        throw new AppError(
          'You can only review products you have purchased. No completed order found for this product.',
          403,
          'NOT_PURCHASED'
        );
      }

      isVerifiedPurchase = true;
    }

    const reviewData = {
      user: userId,
      product: productId,
      vendor: vendorId,
      orderId: orderId || null,
      rating,
      title,
      comment,
      images: images || [],
      pros: pros || [],
      cons: cons || [],
      isVerifiedPurchase,
      status: 'approved'
    };

    const review = await Review.create(reviewData);

    await Review.updateProductRating(productId);

    const updatedProduct = await Product.findById(productId).select('avgRating reviewCount');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review: {
          _id: review._id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          images: review.images,
          isVerifiedPurchase: review.isVerifiedPurchase,
          createdAt: review.createdAt
        },
        productRating: {
          avgRating: updatedProduct.avgRating,
          reviewCount: updatedProduct.reviewCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 5, sort = 'recent', verifiedOnly } = req.query;

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = parseInt(limit) > 0 ? Math.min(parseInt(limit), 20) : 5;
    const skip = (pageNum - 1) * limitNum;

    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'highest') sortOption = { rating: -1, createdAt: -1 };
    if (sort === 'lowest') sortOption = { rating: 1, createdAt: -1 };
    if (sort === 'helpful') sortOption = { isHelpful: -1, createdAt: -1 };

    const query = { product: productId, status: 'approved' };
    if (verifiedOnly === 'true') {
      query.isVerifiedPurchase = true;
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: 'user',
          select: 'name avatar',
          options: { lean: true }
        })
        .populate({
          path: 'response.respondedBy',
          select: 'name shopName',
          options: { lean: true }
        })
        .lean(),
      Review.countDocuments(query)
    ]);

    const ratingBreakdown = await Review.aggregate([
      { $match: { product: productId, status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    const ratings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach(item => {
      ratings[item._id] = item.count;
    });

    const product = await Product.findById(productId).select('avgRating reviewCount').lean();
    const verifiedReviewsCount = await Review.countDocuments({ 
      product: productId, 
      status: 'approved', 
      isVerifiedPurchase: true 
    });

    const enrichedReviews = reviews.map(review => ({
      _id: review._id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      images: review.images,
      pros: review.pros,
      cons: review.cons,
      isVerifiedPurchase: review.isVerifiedPurchase,
      isHelpful: review.isHelpful,
      createdAt: review.createdAt,
      user: review.user ? {
        _id: review.user._id,
        name: review.user.name,
        avatar: review.user.avatar
      } : null,
      response: review.response ? {
        vendorResponse: review.response.vendorResponse,
        respondedAt: review.response.respondedAt,
        respondedBy: review.response.respondedBy
      } : null
    }));

    res.status(200).json({
      success: true,
      data: enrichedReviews,
      summary: {
        avgRating: product?.avgRating || 0,
        totalReviews: product?.reviewCount || 0,
        verifiedReviews: verifiedReviewsCount,
        ratingBreakdown: ratings
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

const getVendorRatings = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const vendor = await User.findById(vendorId).select('name shopName avatar').lean();
    if (!vendor) {
      throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    }

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = parseInt(limit) > 0 ? Math.min(parseInt(limit), 50) : 10;
    const skip = (pageNum - 1) * limitNum;

    const vendorProductIds = await Product.find({ vendorId: vendorId }).distinct('_id');

    if (vendorProductIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          vendor: {
            _id: vendor._id,
            name: vendor.name,
            shopName: vendor.shopName,
            avatar: vendor.avatar
          },
          ratings: null,
          productsReviewed: []
        },
        summary: {
          totalProducts: 0,
          avgRating: 0,
          totalReviews: 0
        }
      });
    }

    const [reviewStats, productRatings] = await Promise.all([
      Review.aggregate([
        { $match: { vendor: vendorId, status: 'approved' } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
            fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
            fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
            threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
            twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
            oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
          }
        },
        {
          $project: {
            avgRating: { $round: ['$avgRating', 2] },
            totalReviews: 1,
            fiveStar: 1,
            fourStar: 1,
            threeStar: 1,
            twoStar: 1,
            oneStar: 1
          }
        }
      ]),
      Product.aggregate([
        { $match: { vendorId: vendorId } },
        { $project: { _id: 1, title: 1, avgRating: 1, reviewCount: 1 } },
        { $sort: { reviewCount: -1 } },
        { $skip: skip },
        { $limit: limitNum }
      ])
    ]);

    const stats = reviewStats[0] || {
      avgRating: 0,
      totalReviews: 0,
      fiveStar: 0,
      fourStar: 0,
      threeStar: 0,
      twoStar: 0,
      oneStar: 0
    };

    res.status(200).json({
      success: true,
      data: {
        vendor: {
          _id: vendor._id,
          name: vendor.name,
          shopName: vendor.shopName,
          avatar: vendor.avatar
        },
        ratings: {
          avgRating: stats.avgRating,
          totalReviews: stats.totalReviews,
          breakdown: {
            fiveStar: stats.fiveStar,
            fourStar: stats.fourStar,
            threeStar: stats.threeStar,
            twoStar: stats.twoStar,
            oneStar: stats.oneStar
          }
        },
        productsReviewed: productRatings
      },
      summary: {
        totalProducts: vendorProductIds.length,
        avgRating: stats.avgRating,
        totalReviews: stats.totalReviews
      }
    });
  } catch (error) {
    next(error);
  }
};

const getUserReviews = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = parseInt(limit) > 0 ? Math.min(parseInt(limit), 100) : 20;
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      Review.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('product', 'title slug images')
        .lean(),
      Review.countDocuments({ user: userId })
    ]);

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};

const markHelpful = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404, 'NOT_FOUND');
    }

    const alreadyVoted = review.helpfulVotes.some(
      vote => vote.user.toString() === userId
    );

    if (alreadyVoted) {
      throw new AppError('You have already marked this review as helpful', 400, 'ALREADY_VOTED');
    }

    review.helpfulVotes.push({ user: userId });
    review.isHelpful += 1;
    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review marked as helpful',
      data: { helpfulCount: review.isHelpful }
    });
  } catch (error) {
    next(error);
  }
};

const vendorRespondToReview = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { reviewId } = req.params;
    const { response } = req.body;

    if (!response || response.trim().length === 0) {
      throw new AppError('Response is required', 400, 'VALIDATION_ERROR');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404, 'NOT_FOUND');
    }

    if (review.vendor.toString() !== userId) {
      throw new AppError('You can only respond to reviews for your products', 403, 'FORBIDDEN');
    }

    review.response = {
      vendorResponse: response.trim(),
      respondedAt: new Date(),
      respondedBy: userId
    };

    await review.save();

    res.status(200).json({
      success: true,
      message: 'Response added to review',
      data: { response: review.response }
    });
  } catch (error) {
    next(error);
  }
};

// exports moved to end

const reportReview = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { reviewId } = req.params;
    const { reason, details } = req.body;

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Report reason is required', 400, 'VALIDATION_ERROR');
    }

    const validReasons = ['fake_information', 'inappropriate_content', 'spam', 'misleading', 'other'];
    if (!validReasons.includes(reason)) {
      throw new AppError(`Invalid reason. Must be one of: ${validReasons.join(', ')}`, 400, 'INVALID_REASON');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404, 'NOT_FOUND');
    }

    if (review.user.toString() === userId) {
      throw new AppError('You cannot report your own review', 400, 'SELF_REPORT');
    }

    const alreadyReported = review.reports?.some(r => r.reportedBy.toString() === userId);
    if (alreadyReported) {
      throw new AppError('You have already reported this review', 400, 'ALREADY_REPORTED');
    }

    if (!review.reports) {
      review.reports = [];
    }

    review.reports.push({
      reportedBy: userId,
      reason,
      details: details || '',
      reportedAt: new Date()
    });

    if (review.reports.length >= 3) {
      review.status = 'flagged';
    }

    await review.save();

    res.status(200).json({
      success: true,
      message: 'Review reported successfully',
      data: { status: review.status }
    });
  } catch (error) {
    next(error);
  }
};

const adminDeleteReview = async (req, res, next) => {
  try {
    const adminId = req.userId;
    const { reviewId } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404, 'NOT_FOUND');
    }

    const productId = review.product;

    await Review.findByIdAndDelete(reviewId);

    await Review.updateProductRating(productId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: { deletedReviewId: reviewId }
    });
  } catch (error) {
    next(error);
  }
};

const adminHideReview = async (req, res, next) => {
  try {
    const adminId = req.userId;
    const { reviewId } = req.params;
    const { action } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404, 'NOT_FOUND');
    }

    const productId = review.product;

    if (action === 'hide') {
      review.status = 'rejected';
      review.moderationNote = review.moderationNote || {};
      review.moderationNote.note = 'Hidden by admin';
      review.moderationNote.createdBy = adminId;
      review.moderationNote.createdAt = new Date();
    } else if (action === 'show') {
      review.status = 'approved';
      if (review.moderationNote) {
        review.moderationNote.note = 'Reinstated by admin';
        review.moderationNote.createdAt = new Date();
      }
    } else {
      throw new AppError('Invalid action. Use "hide" or "show"', 400, 'INVALID_ACTION');
    }

    await review.save();

    await Review.updateProductRating(productId);

    res.status(200).json({
      success: true,
      message: `Review ${action === 'hide' ? 'hidden' : 'shown'} successfully`,
      data: { status: review.status }
    });
  } catch (error) {
    next(error);
  }
};

const deleteOwnReview = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new AppError('Review not found', 404, 'NOT_FOUND');
    }

    if (review.user.toString() !== userId) {
      throw new AppError('You can only delete your own reviews', 403, 'FORBIDDEN');
    }

    const productId = review.product;

    await Review.findByIdAndDelete(reviewId);

    await Review.updateProductRating(productId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getVendorRatings,
  getUserReviews,
  markHelpful,
  vendorRespondToReview,
  reportReview,
  adminDeleteReview,
  adminHideReview,
  deleteOwnReview
};

