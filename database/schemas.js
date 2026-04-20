/**
 * GearBazar - MongoDB/Mongoose Schemas
 * Auto-Parts Marketplace Database Design
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/* ============================================================================
 * UTILITY SCHEMAS
 * ============================================================================ */

// Address Schema (embedded in User, Garage, Order)
const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: 'USA' },
  coordinates: {
    lat: Number,
    lng: Number
  }
}, { _id: false });

// Vehicle Compatibility Schema (embedded in Product)
const vehicleCompatibilitySchema = new mongoose.Schema({
  make: { type: String, required: true },        // e.g., Toyota, Honda
  model: { type: String, required: true },       // e.g., Camry, Civic
  year: { type: Number, required: true },       // e.g., 2020
  variant: { type: String },                     // e.g., V6, LX
  engine: { type: String }                       // e.g., 2.5L, 1.8L
}, { _id: false });

// Pricing Schema (embedded in Product)
const pricingSchema = new mongoose.Schema({
  publicPrice: { type: Number, required: true },     // B2C retail price
  wholesalePrice: { type: Number, required: true },   // B2B price for garages
  costPrice: { type: Number },                        // Internal cost (admin only)
  currency: { type: String, default: 'USD' },
  discountPercent: { type: Number, default: 0 },
  minOrderQty: { type: Number, default: 1 }           // Minimum for wholesale
}, { _id: false });

// Inventory Schema (embedded in Product)
const inventorySchema = new mongoose.Schema({
  quantity: { type: Number, default: 0, min: 0 },
  warehouse: { type: String },
  reservedQty: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 10 },
  trackInventory: { type: Boolean, default: true },
  allowBackorder: { type: Boolean, default: false }
}, { _id: false });

// Review Schema (embedded or referenced)
const reviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

/* ============================================================================
 * USER MODEL
 * ============================================================================ */

const userSchema = new mongoose.Schema({
  // Authentication
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  
  // Authorization
  role: {
    type: String,
    enum: ['admin', 'seller', 'garage_owner', 'customer'],
    default: 'customer',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Profile
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String },
  avatar: { type: String },
  
  // Address (embedded for quick access)
  address: addressSchema,
  
  // Role-specific fields
  shopDetails: {
    // For Seller role
    shopName: { type: String },
    shopDescription: { type: String },
    businessLicense: { type: String },
    taxId: { type: String },
    bankAccount: {
      bankName: String,
      accountNumber: String,
      routingNumber: String
    },
    // For Garage Owner role
    garageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Garage' }
  },
  
  // Business Tier (for pricing)
  businessTier: {
    type: String,
    enum: ['standard', 'silver', 'gold', 'platinum'],
    default: 'standard'
  },
  creditLimit: { type: Number, default: 0 },
  availableCredit: { type: Number, default: 0 },
  
  // Verification
  verificationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  
  // Timestamps
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ 'shopDetails.garageId': 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

/* ============================================================================
 * PRODUCT MODEL
 * ============================================================================ */

const productSchema = new mongoose.Schema({
  // Seller reference (required for multi-vendor)
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Basic Info
  name: { type: String, required: true, trim: true },
  sku: { type: String, unique: true, sparse: true },
  partNumber: { type: String },                     // Manufacturer part number
  barcode: { type: String },
  description: { type: String },
  
  // Categorization
  category: {
    type: String,
    required: true,
    enum: [
      'engine', 'brakes', 'suspension', 'electrical',
      'body', 'interior', 'transmission', 'cooling',
      'exhaust', 'fuel', 'oils', 'accessories', 'tools'
    ],
    index: true
  },
  subCategory: { type: String },
  brand: { type: String, required: true, index: true },
  
  // Vehicle Compatibility (embedded array for multiple vehicles)
  vehicleCompatibility: {
    type: [vehicleCompatibilitySchema],
    default: []
  },
  
  // Pricing (dual-pricing system)
  pricing: {
    type: pricingSchema,
    required: true
  },
  
  // Inventory
  inventory: {
    type: inventorySchema,
    required: true
  },
  
  // Media
  images: [{
    url: { type: String, required: true },
    alt: { type: String },
    isPrimary: { type: Boolean, default: false }
  }],
  videos: [{ type: String }],
  
  // Specifications (dynamic key-value for different part types)
  specifications: {
    type: Map,
    of: String
  },
  
  // Attributes for filtering
  attributes: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    warrantyMonths: { type: Number, default: 12 },
    countryOfOrigin: { type: String }
  },
  
  // Status
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  
  // SEO
  metaTitle: { type: String },
  metaDescription: { type: String },
  
  // Reviews (referenced for scalability)
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  avgRating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for current price (considering discount)
productSchema.virtual('currentPrice').get(function() {
  if (this.pricing.discountPercent > 0) {
    return this.pricing.publicPrice * (1 - this.pricing.discountPercent / 100);
  }
  return this.pricing.publicPrice;
});

// Indexes for query performance
productSchema.index({ sellerId: 1, isActive: 1 });
productSchema.index({ category: 1, brand: 1 });
productSchema.index({ 'vehicleCompatibility.make': 1, 'vehicleCompatibility.model': 1 });
productSchema.index({ 'pricing.publicPrice': 1 });
productSchema.index({ name: 'text', description: 'text', brand: 'text' }); // Text search

const Product = mongoose.model('Product', productSchema);

/* ============================================================================
 * ORDER MODEL - Multi-Vendor Support
 * ============================================================================ */

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: { type: String, required: true },
  sku: { type: String },
  image: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },        // Price at time of order
  discount: { type: Number, default: 0 },
  subtotal: { type: Number, required: true }
}, { _id: true });

// Order Status History
const orderStatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    required: true
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

// Shipping Details
const shippingSchema = new mongoose.Schema({
  carrier: { type: String },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },
  shippingAddress: { type: addressSchema, required: true },
  shippingCost: { type: Number, default: 0 },
  shippingWeight: { type: Number }
}, { _id: false });

// Payment Details
const paymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['card', 'bank_transfer', 'cash_on_delivery', 'credit_account'],
    required: true
  },
  transactionId: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  status: {
    type: String,
    enum: ['pending', 'authorized', 'captured', 'failed', 'refunded'],
    default: 'pending'
  },
  paidAt: { type: Date },
  details: { type: Map, of: String }
}, { _id: false });

// Invoice Schema
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'overdue'],
    default: 'pending'
  },
  dueDate: { type: Date }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  // Order Identification
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Customer Reference
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Multi-Vendor: Group items by seller
  items: {
    type: [orderItemSchema],
    required: true,
    validate: [arr => arr.length > 0, 'Order must have at least one item']
  },
  
  // Get unique sellers from items for split orders
  sellerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Order Status (overall)
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Per-seller status (for multi-vendor tracking)
  sellerStatuses: [{
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String },
    note: { type: String },
    updatedAt: { type: Date }
  }],
  
  // Status History
  statusHistory: [orderStatusHistorySchema],
  
  // Financial
  subtotal: { type: Number, required: true },
  taxAmount: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  
  // Payment
  payment: paymentSchema,
  
  // Shipping
  shipping: shippingSchema,
  
  // Invoices (for each seller in multi-vendor order)
  invoices: [invoiceSchema],
  
  // Billing Address (may differ from shipping)
  billingAddress: addressSchema,
  
  // Notes
  customerNote: { type: String },
  internalNote: { type: String },
  
  // Fulfillment
  fulfillmentStatus: {
    type: String,
    enum: ['unfulfilled', 'partial', 'fulfilled'],
    default: 'unfulfilled'
  },
  
  // Timestamps
  orderedAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  cancelledAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for isMultiVendor
orderSchema.virtual('isMultiVendor').get(function() {
  return this.sellerIds && this.sellerIds.length > 1;
});

// Pre-save: Generate order number
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = `GB-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
  }
  
  // Extract unique sellerIds from items
  if (this.isModified('items')) {
    const sellerSet = new Set(this.items.map(item => item.sellerId.toString()));
    this.sellerIds = Array.from(sellerSet).map(id => new mongoose.Types.ObjectId(id));
  }
  
  next();
});

// Indexes
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ 'sellerStatuses.sellerId': 1, status: 1 });
orderSchema.index({ 'payment.status': 1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

/* ============================================================================
 * GARAGE MODEL
 * ============================================================================ */

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String },
  price: { type: Number, required: true },
  priceType: { type: String, enum: ['fixed', 'hourly', 'quote'], default: 'fixed' },
  duration: { type: Number },                     // in minutes
  isActive: { type: Boolean, default: true }
}, { _id: true });

const garageSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Basic Info
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String },
  phone: { type: String, required: true },
  email: { type: String },
  website: { type: String },
  
  // Location
  address: { type: addressSchema, required: true },
  serviceArea: [{ type: String }],               // Zip codes served
  
  // Business Info
  businessLicense: { type: String },
  certifications: [{ type: String }],
  yearsInBusiness: { type: Number },
  
  // Services
  services: [serviceSchema],
  
  // Working Hours
  workingHours: {
    monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    sunday: { open: String, close: String, isClosed: { type: Boolean, default: true } }
  },
  
  // Media
  images: [{ type: String }],
  logo: { type: String },
  
  // Rating
  avgRating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  reviews: [reviewSchema],
  
  // Status
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  // Features
  features: [{
    type: String,
    enum: ['waiting_room', 'wifi', 'loaner_car', 'pickup_delivery', 'online_booking', 'warranty']
  }],
  
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
garageSchema.index({ 'address.city': 1, isActive: 1 });
garageSchema.index({ 'services.name': 'text' });

const Garage = mongoose.model('Garage', garageSchema);

/* ============================================================================
 * APPOINTMENT MODEL
 * ============================================================================ */

const appointmentSchema = new mongoose.Schema({
  garageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garage',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: { type: String },               // Reference to service in Garage.services
  serviceName: { type: String, required: true },
  vehicleInfo: {
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    vin: { type: String },
    mileage: { type: Number },
    note: { type: String }
  },
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String, required: true },
  estimatedDuration: { type: Number },        // minutes
  
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending'
  },
  
  totalPrice: { type: Number },
  
  notes: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

appointmentSchema.index({ garageId: 1, scheduledDate: 1 });
appointmentSchema.index({ customerId: 1, status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

/* ============================================================================
 * REVIEW MODEL (Standalone for scalability)
 * ============================================================================ */

const standaloneReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    index: true
  },
  garageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garage'
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: { type: String },
  comment: { type: String },
  pros: [{ type: String }],
  cons: [{ type: String }],
  
  isVerifiedPurchase: { type: Boolean, default: false },
  isHelpful: { type: Number, default: 0 },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending'
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

standaloneReviewSchema.index({ productId: 1, createdAt: -1 });
standaloneReviewSchema.index({ garageId: 1, createdAt: -1 });

const Review = mongoose.model('Review', standaloneReviewSchema);

/* ============================================================================
 * EXPORTS
 * ============================================================================ */

module.exports = {
  User,
  Product,
  Order,
  Garage,
  Appointment,
  Review
};

/* ============================================================================
 * COLLECTION RELATIONSHIPS DIAGRAM
 * ============================================================================
 * 
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                         COLLECTION RELATIONSHIPS                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 *    ┌─────────────┐          ┌─────────────┐
 *    │    User     │          │   Garage    │
 *    │  (seller)   │──┐       │             │
 *    └─────────────┘  │       └─────────────┘
 *           │         │              │
 *           │         │              │
 *           ▼         │              ▼
 *    ┌─────────────┐  │       ┌─────────────┐
 *    │   Product   │──┼──┐    │ Appointment │
 *    │             │  │  │    │             │
 *    └─────────────┘  │  │    └─────────────┘
 *           │         │  │           │
 *           │         │  │           │
 *           ▼         │  ▼           │
 *    ┌─────────────┐  │  ┌─────────────┐
 *    │    Order    │◄─┘  │    Review   │
 *    │             │     │             │
 *    └─────────────┘     └─────────────┘
 * 
 * RELATIONSHIP TYPE LEGEND:
 * ─────────────────────────
 * ───► : Reference (many-to-one, one-to-many)
 * ═══► : Embedding (one-to-one, one-to-many - denormalized)
 * ◄──► : Many-to-Many (via array of ObjectId)
 * 
 * USER → PRODUCT : One-to-Many (One Seller has Many Products)
 *   - Relationship: Referencing (product.sellerId → user._id)
 *   - Reason: Products are independent entities, need seller info for orders
 * 
 * USER → ORDER : One-to-Many (One Customer has Many Orders)
 *   - Relationship: Referencing (order.customerId → user._id)
 *   - Reason: Orders need customer details for history and fulfillment
 * 
 * PRODUCT → ORDER : Many-to-Many via Order Items
 *   - Relationship: Embedding (order.items[] contains product reference)
 *   - Reason: Order items store price at time of purchase, snapshot of product info
 * 
 * SELLER → ORDER : One-to-Many (One Seller has Many Order Items)
 *   - Relationship: Referencing (order.items[].sellerId → user._id)
 *   - Reason: Track sales per seller, split fulfillment, invoicing
 * 
 * GARAGE → APPOINTMENT : One-to-Many
 *   - Relationship: Referencing (appointment.garageId → garage._id)
 *   - Reason: Garage manages their appointments
 * 
 * USER → GARAGE : One-to-One (Garage Owner owns one Garage)
 *   - Relationship: Referencing (garage.ownerId → user._id)
 *   - Reason: User's shopDetails.garageId points to garage
 * 
 * PRODUCT → REVIEW : One-to-Many
 *   - Relationship: Referencing (review.productId → product._id)
 *   - Reason: Reviews are independent entities, can be moderated
 * 
 * ORDER → INVOICE : One-to-Many (Embed)
 *   - Relationship: Embedding (order.invoices[] - one per seller)
 *   - Reason: Invoices are tightly coupled to order, always fetched together
 * 
 * ORDER → SHIPPING : One-to-One (Embed)
 *   - Relationship: Embedding (order.shipping)
 *   - Reason: Shipping details always needed with order
 * 
 * ORDER → PAYMENT : One-to-One (Embed)
 *   - Relationship: Embedding (order.payment)
 *   - Reason: Payment info always needed with order
 * 
 * ════════════════════════════════════════════════════════════════════════
 * EMBEDDING vs REFERENCING DECISION MATRIX
 * ════════════════════════════════════════════════════════════════════════
 * 
 * ┌──────────────────┬──────────────┬──────────────┬────────────────────┐
 * │    Collection    │   Embedded   │  Referenced  │       Reason       │
 * ├──────────────────┼──────────────┼──────────────┼────────────────────┤
 * │ Order Items      │      ✓       │      -       │ Always fetched     │
 * │ Order Shipping   │      ✓       │      -       │ Always fetched     │
 * │ Order Payment    │      ✓       │      -       │ Always fetched     │
 * │ Order Invoices   │      ✓       │      -       │ Tightly coupled    │
 * │ Product Pricing  │      ✓       │      -       │ Always needed      │
 * │ Product Inventory│      ✓       │      -       │ Part of product    │
 * │ Product Vehicle  │      ✓       │      -       │ Array of small     │
 * │   Compatibility  │              │              │ structs            │
 * │ User Address     │      ✓       │      -       │ Simple, single     │
 * │ Garage Services  │      ✓       │      -       │ Small array        │
 * │ Garage Hours     │      ✓       │      -       │ Fixed structure    │
 * ├──────────────────┼──────────────┼──────────────┼────────────────────┤
 * │ Product → Seller │      -       │      ✓       │ Independent        │
 * │ Order → Customer │      -       │      ✓       │ User can update    │
 * │ Order → Products │      -       │      ✓       │ Product may change │
 * │ User → Garage    │      -       │      ✓       │ 1:1 relationship   │
 * │ Appointment →    │      -       │      ✓       │ Independent        │
 * │   Garage         │              │              │ entity              │
 * │ Review → Product │      -       │      ✓       │ Scalability        │
 * │ Review → User    │      -       │      ✓       │ Can be moderated   │
 * └──────────────────┴──────────────┴──────────────┴────────────────────┘
 */