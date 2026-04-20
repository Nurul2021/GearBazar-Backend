/**
 * Review Model - Auto-parts Marketplace
 * 
 * Fields:
 * - user (ObjectId), product (ObjectId), vendor (ObjectId)
 * - rating (Number, 1-5), comment (String), images (array)
 * - Unique compound index: user + product
 * - Timestamps: createdAt, updatedAt
 * - Rating validation: required, 1-5
 */

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    index: true
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vendor is required'],
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer'
    }
  },
  title: {
    type: String,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    trim: true
  },
  comment: {
    type: String,
    maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    trim: true
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Invalid image URL'
    }
  }],
  pros: [{
    type: String,
    maxlength: [100, 'Pro cannot exceed 100 characters']
  }],
  cons: [{
    type: String,
    maxlength: [100, 'Con cannot exceed 100 characters']
  }],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  isHelpful: {
    type: Number,
    default: 0,
    min: 0
  },
  helpfulVotes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    votedAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved',
    index: true
  },
  moderationNote: {
    type: String,
    maxlength: [500],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date }
  },
  response: {
    vendorResponse: { type: String, maxlength: [1000] },
    respondedAt: { type: Date },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

reviewSchema.index({ user: 1, product: 1 }, { unique: true, message: 'You have already reviewed this product' });

reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ vendor: 1, createdAt: -1 });
reviewSchema.index({ rating: -1, createdAt: -1 });
reviewSchema.index({ isVerifiedPurchase: 1, createdAt: -1 });

reviewSchema.virtual('isHelpfulCount').get(function() {
  return this.isHelpful;
});

reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

reviewSchema.pre('save', function(next) {
  if (this.isModified('rating') && (this.rating < 1 || this.rating > 5)) {
    const err = new Error('Rating must be between 1 and 5');
    err.name = 'ValidationError';
    return next(err);
  }
  next();
});

reviewSchema.statics.calculateProductRating = async function(productId) {
  const stats = await this.aggregate([
    { $match: { product: productId, status: 'approved' } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  if (stats.length === 0) {
    return { avgRating: 0, reviewCount: 0 };
  }

  const { averageRating, reviewCount } = stats[0];
  
  return {
    avgRating: Math.round(averageRating * 10) / 10,
    reviewCount
  };
};

reviewSchema.statics.updateProductRating = async function(productId) {
  const stats = await this.calculateProductRating(productId);
  
  const Product = this.db.model('Product');
  await Product.findByIdAndUpdate(productId, {
    $set: {
      avgRating: stats.avgRating,
      reviewCount: stats.reviewCount
    }
  });
  
  return stats;
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;