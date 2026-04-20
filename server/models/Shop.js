/**
 * Shop Model - Vendor Shop Management
 */

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true, trim: true, maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  zipCode: { type: String, required: true, trim: true, maxlength: 20 },
  country: { type: String, default: 'USA', maxlength: 100 }
}, { _id: false });

const businessRegistrationSchema = new mongoose.Schema({
  registrationNumber: { type: String, required: true, maxlength: 50 },
  legalBusinessName: { type: String, required: true, maxlength: 200 },
  businessType: {
    type: String,
    enum: ['sole_proprietorship', 'partnership', 'llc', 'corporation', 'non_profit'],
    required: true
  },
  taxId: { type: String, maxlength: 50 },
  incorporationDate: { type: Date },
  issuedAuthority: { type: String, maxlength: 200 },
  documentUrl: { type: String },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const operatingHoursSchema = new mongoose.Schema({
  monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
  tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
  wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
  thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
  friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
  saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
  sunday: { open: String, close: String, isClosed: { type: Boolean, default: true } }
}, { _id: false });

const shopSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  shopName: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Shop name must be at least 3 characters'],
    maxlength: [100, 'Shop name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  shopAddress: {
    type: addressSchema,
    required: true
  },
  contactNumber: {
    type: String,
    required: true,
    trim: true,
    maxlength: [20, 'Contact number cannot exceed 20 characters']
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },
  shopLogo: {
    url: { type: String },
    publicId: { type: String }
  },
  coverImage: {
    url: { type: String },
    publicId: { type: String }
  },
  businessRegistration: {
    type: businessRegistrationSchema,
    required: true
  },
  operatingHours: {
    type: operatingHoursSchema
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'inactive',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  rating: {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 }
  },
  socialLinks: {
    website: { type: String },
    facebook: { type: String },
    instagram: { type: String },
    twitter: { type: String }
  },
  settings: {
    allowReviews: { type: Boolean, default: true },
    showContactInfo: { type: Boolean, default: true },
    autoAcceptOrders: { type: Boolean, default: false }
  },
  suspendedAt: { type: Date },
  suspendedReason: { type: String, maxlength: 500 },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activatedAt: { type: Date },
  lastActiveAt: { type: Date }
}, {
  timestamps: true
});

shopSchema.index({ shopName: 'text', description: 'text' });
shopSchema.index({ status: 1, isVerified: 1 });
shopSchema.index({ 'shopAddress.city': 1, status: 1 });

shopSchema.pre('save', function(next) {
  if (this.isModified('shopName') || !this.slug) {
    this.slug = this.shopName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') 
      + '-' + Date.now().toString(36);
  }
  next();
});

const Shop = mongoose.model('Shop', shopSchema);

module.exports = Shop;