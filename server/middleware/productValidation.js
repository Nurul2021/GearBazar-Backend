/**
 * Product Validation Middleware - Zod Schema
 * Dual-Pricing System Validation
 */

const { z } = require('zod');

const productValidationSchema = z.object({
  body: z.object({
    title: z.string()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title cannot exceed 200 characters'),
    
    description: z.string()
      .max(5000, 'Description cannot exceed 5000 characters')
      .optional(),
    
    brand: z.string()
      .min(1, 'Brand is required')
      .max(100, 'Brand cannot exceed 100 characters'),
    
    category: z.string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID')
      .optional(),
    
    subCategory: z.string()
      .max(100, 'Sub-category cannot exceed 100 characters')
      .optional(),
    
    compatibility: z.array(z.object({
      make: z.string().min(1, 'Make is required'),
      model: z.string().min(1, 'Model is required'),
      years: z.string().min(1, 'Years are required'),
      trim: z.string().optional(),
      engine: z.string().optional()
    })).max(50, 'Cannot exceed 50 compatibility entries').optional(),
    
    publicPrice: z.number()
      .positive('Public price must be positive')
      .max(999999, 'Price cannot exceed 999999'),
    
    wholesalePrice: z.number()
      .positive('Wholesale price must be positive')
      .max(999999, 'Wholesale price cannot exceed 999999'),
    
    costPrice: z.number()
      .positive('Cost price must be positive')
      .optional(),
    
    discountPercent: z.number()
      .min(0, 'Discount cannot be negative')
      .max(100, 'Discount cannot exceed 100%')
      .default(0),
    
    minOrderQty: z.number()
      .int('Minimum order quantity must be an integer')
      .positive('Minimum order quantity must be positive')
      .default(1),
    
    stockQuantity: z.number()
      .int('Stock quantity must be an integer')
      .min(0, 'Stock quantity cannot be negative')
      .default(0),
    
    sku: z.string()
      .max(50, 'SKU cannot exceed 50 characters')
      .optional(),
    
    unit: z.enum(['pcs', 'set', 'box', 'pair', 'liter', 'kg', 'meter'])
      .default('pcs'),
    
    partNumber: z.string()
      .max(50, 'Part number cannot exceed 50 characters')
      .optional(),
    
    manufacturer: z.string()
      .max(100, 'Manufacturer cannot exceed 100 characters')
      .optional(),
    
    warrantyMonths: z.number()
      .int('Warranty months must be an integer')
      .min(0, 'Warranty months cannot be negative')
      .max(120, 'Warranty cannot exceed 120 months')
      .default(12),
    
    weight: z.number()
      .positive('Weight must be positive')
      .optional(),
    
    dimensions: z.object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive()
    }).optional(),
    
    images: z.array(z.string().url('Invalid image URL'))
      .max(10, 'Cannot exceed 10 images')
      .optional(),
    
    tags: z.array(z.string())
      .max(20, 'Cannot exceed 20 tags')
      .optional(),
    
    metaTitle: z.string()
      .max(60, 'Meta title cannot exceed 60 characters')
      .optional(),
    
    metaDescription: z.string()
      .max(160, 'Meta description cannot exceed 160 characters')
      .optional()
  })
}).refine(
  data => data.body.wholesalePrice <= data.body.publicPrice,
  {
    message: 'Wholesale price cannot be greater than public price',
    path: ['wholesalePrice']
  }
).refine(
  data => !data.body.costPrice || data.body.costPrice <= data.body.wholesalePrice,
  {
    message: 'Cost price cannot be greater than wholesale price',
    path: ['costPrice']
  }
);

const updateProductSchema = z.object({
  params: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID')
  }),
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(5000).optional(),
    brand: z.string().min(1).max(100).optional(),
    category: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    subCategory: z.string().max(100).optional(),
    compatibility: z.array(z.object({
      make: z.string().min(1),
      model: z.string().min(1),
      years: z.string().min(1),
      trim: z.string().optional(),
      engine: z.string().optional()
    })).max(50).optional(),
    publicPrice: z.number().positive().max(999999).optional(),
    wholesalePrice: z.number().positive().max(999999).optional(),
    costPrice: z.number().positive().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    minOrderQty: z.number().int().positive().optional(),
    stockQuantity: z.number().int().min(0).optional(),
    sku: z.string().max(50).optional(),
    unit: z.enum(['pcs', 'set', 'box', 'pair', 'liter', 'kg', 'meter']).optional(),
    partNumber: z.string().max(50).optional(),
    manufacturer: z.string().max(100).optional(),
    warrantyMonths: z.number().int().min(0).max(120).optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional()
  })
}).refine(
  data => {
    if (data.body.publicPrice !== undefined && data.body.wholesalePrice !== undefined) {
      return data.body.wholesalePrice <= data.body.publicPrice;
    }
    return true;
  },
  {
    message: 'Wholesale price cannot be greater than public price',
    path: ['wholesalePrice']
  }
);

const validateProductInput = (req, res, next) => {
  try {
    productValidationSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid product data',
        errors
      });
    }
    next(error);
  }
};

const validateUpdateProduct = (req, res, next) => {
  try {
    updateProductSchema.parse({
      params: req.params,
      body: req.body
    });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid product update data',
        errors
      });
    }
    next(error);
  }
};

module.exports = {
  productValidationSchema,
  updateProductSchema,
  validateProductInput,
  validateUpdateProduct
};