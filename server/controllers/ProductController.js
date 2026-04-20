/**
 * Product Controller - Get All Products with Advanced Filtering
 */

const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

const getAllProducts = async (req, res, next) => {
  try {
    const {
      category,
      brand,
      minPrice,
      maxPrice,
      make,
      model,
      year,
      search,
      page = 1,
      limit = 20,
      sort = 'newest',
      inStock,
      featured,
      vendorId
    } = req.query;

    const pageNum = parseInt(page) > 0 ? parseInt(page) : 1;
    const limitNum = parseInt(limit) > 0 ? Math.min(parseInt(limit), 100) : 20;
    const skip = (pageNum - 1) * limitNum;

    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (brand) {
      const brands = brand.split(',').map(b => b.trim().toUpperCase());
      query.brand = { $in: brands };
    }

    if (minPrice || maxPrice) {
      query['pricing.publicPrice'] = {};
      if (minPrice) query['pricing.publicPrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.publicPrice'].$lte = parseFloat(maxPrice);
    }

    if (make || model || year) {
      query.compatibility = {};
      if (make) query.compatibility.make = make.toUpperCase();
      if (model) query.compatibility.model = { $regex: model, $options: 'i' };
      if (year) {
        const yearNum = parseInt(year);
        query.compatibility.years = {
          $regex: `${yearNum}`,
          $options: 'i'
        };
      }
    }

    if (inStock === 'true') {
      query['inventory.stockQuantity'] = { $gt: 0 };
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (search) {
      query.$text = { $search: search };
    }

    let sortOption = {};
    switch (sort) {
      case 'price_asc':
        sortOption = { 'pricing.publicPrice': 1 };
        break;
      case 'price_desc':
        sortOption = { 'pricing.publicPrice': -1 };
        break;
      case 'name_asc':
        sortOption = { title: 1 };
        break;
      case 'name_desc':
        sortOption = { title: -1 };
        break;
      case 'popularity':
        sortOption = { totalSold: -1 };
        break;
      case 'newest':
      default:
        sortOption = { createdAt: -1 };
    }

    const user = req.user || null;
    const canAccessWholesale = determineWholesaleAccess(user);

    let products;
    if (canAccessWholesale) {
      products = await Product.find(query)
        .select('-__v')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate('category', 'name slug')
        .populate('vendorId', 'name shopName')
        .lean();
    } else {
      products = await Product.find(query)
        .select('-__v -pricing.costPrice')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .populate('category', 'name slug')
        .populate('vendorId', 'name shopName')
        .lean();
    }

    const total = await Product.countDocuments(query);

    const enrichedProducts = products.map(product => {
      const pricing = canAccessWholesale
        ? {
            publicPrice: product.pricing.publicPrice,
            wholesalePrice: product.pricing.wholesalePrice,
            discountPercent: product.pricing.discountPercent,
            priceType: 'wholesale'
          }
        : {
            publicPrice: product.pricing.publicPrice,
            discountPercent: product.pricing.discountPercent,
            priceType: 'retail'
          };

      const finalPrice = product.pricing.discountPercent > 0
        ? product.pricing.publicPrice * (1 - product.pricing.discountPercent / 100)
        : product.pricing.publicPrice;

      return {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        brand: product.brand,
        category: product.category,
        vendor: product.vendorId,
        images: product.images?.slice(0, 1) || [],
        compatibility: product.compatibility?.slice(0, 3) || [],
        pricing: {
          ...pricing,
          finalPrice: Math.round(finalPrice * 100) / 100
        },
        inventory: {
          stockStatus: product.inventory.stockQuantity > 0 ? 'in_stock' : 'out_of_stock',
          stockQuantity: canAccessWholesale ? product.inventory.stockQuantity : undefined
        },
        avgRating: product.avgRating,
        reviewCount: product.reviewCount,
        totalSold: product.totalSold,
        createdAt: product.createdAt
      };
    });

    const facets = await Promise.all([
      Product.aggregate([
        { $match: query },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Product.aggregate([
        { $match: query },
        { $unwind: '$compatibility' },
        { $group: { _id: '$compatibility.make', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const brands = facets[0].map(item => ({ brand: item._id, count: item.count }));
    const vehicleMakes = facets[1].map(item => ({ make: item._id, count: item.count }));

    res.status(200).json({
      success: true,
      data: enrichedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      filters: {
        availableBrands: brands,
        availableMakes: vehicleMakes
      },
      userPricing: canAccessWholesale ? 'wholesale' : 'retail'
    });
  } catch (error) {
    next(error);
  }
};

const determineWholesaleAccess = (user) => {
  if (!user) return false;
  
  const allowedRoles = ['seller', 'garage', 'admin'];
  const hasRole = allowedRoles.includes(user.role);
  const isVerified = user.isVerified === true;
  const isActive = user.isActive !== false;

  return hasRole && isVerified && isActive;
};

const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug, isActive: true })
      .populate('category', 'name slug')
      .populate('vendorId', 'name shopName email phone')
      .lean();

    if (!product) {
      throw new AppError('Product not found', 404, 'NOT_FOUND');
    }

    const user = req.user || null;
    const canAccessWholesale = determineWholesaleAccess(user);

    const pricing = canAccessWholesale
      ? {
          publicPrice: product.pricing.publicPrice,
          wholesalePrice: product.pricing.wholesalePrice,
          costPrice: product.pricing.costPrice,
          discountPercent: product.pricing.discountPercent,
          minOrderQty: product.pricing.minOrderQty,
          priceType: 'wholesale'
        }
      : {
          publicPrice: product.pricing.publicPrice,
          discountPercent: product.pricing.discountPercent,
          minOrderQty: product.pricing.minOrderQty,
          priceType: 'retail'
        };

    const finalPrice = product.pricing.discountPercent > 0
      ? product.pricing.publicPrice * (1 - product.pricing.discountPercent / 100)
      : product.pricing.publicPrice;

    res.status(200).json({
      success: true,
      data: {
        ...product,
        pricing: {
          ...pricing,
          finalPrice: Math.round(finalPrice * 100) / 100
        }
      },
      userPricing: canAccessWholesale ? 'wholesale' : 'retail'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductBySlug
};