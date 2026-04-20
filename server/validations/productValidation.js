/**
 * Product Validation Schemas (Zod)
 */

const { z } = require('zod');

const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['price', 'createdAt', 'name', 'rating']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  inStock: z.coerce.boolean().optional(),
  search: z.string().max(100).optional()
});

const vehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  variant: z.string().optional(),
  engine: z.string().optional()
});

const pricingSchema = z.object({
  publicPrice: z.number().positive(),
  wholesalePrice: z.number().positive(),
  costPrice: z.number().positive().optional(),
  currency: z.string().default('USD'),
  discountPercent: z.number().min(0).max(100).default(0),
  minOrderQty: z.number().int().positive().default(1)
});

const productBodySchema = z.object({
  name: z.string().min(3).max(200),
  partNumber: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(['engine', 'brakes', 'suspension', 'electrical', 'body', 'interior', 'transmission', 'cooling', 'exhaust', 'fuel', 'oils', 'accessories', 'tools']),
  subCategory: z.string().max(50).optional(),
  brand: z.string().min(1).max(100),
  vehicleCompatibility: z.array(vehicleSchema).max(50).optional(),
  pricing: pricingSchema,
  inventory: z.object({
    quantity: z.number().int().min(0).default(0),
    warehouse: z.string().optional(),
    reorderLevel: z.number().int().min(0).default(10),
    trackInventory: z.boolean().default(true),
    allowBackorder: z.boolean().default(false)
  }).optional(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().default(false)
  })).max(10).optional(),
  specifications: z.record(z.string()).optional(),
  attributes: z.object({
    weight: z.number().positive().optional(),
    dimensions: z.object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive()
    }).optional(),
    warrantyMonths: z.number().int().positive().default(12),
    countryOfOrigin: z.string().max(50).optional()
  }).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional()
});

const validateProductQuery = (req, res, next) => {
  try {
    req.validated = productQuerySchema.parse(req.query);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    next(error);
  }
};

const validateProductBody = (req, res, next) => {
  try {
    req.validated = productBodySchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      });
    }
    next(error);
  }
};

module.exports = {
  productQuerySchema,
  productBodySchema,
  validateProductQuery,
  validateProductBody
};