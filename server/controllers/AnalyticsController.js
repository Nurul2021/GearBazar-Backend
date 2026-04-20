/**
 * Vendor Analytics Controller - MongoDB Aggregation Pipelines
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

const PLATFORM_COMMISSION_RATE = 0.10;

const getVendorAnalytics = async (req, res, next) => {
  try {
    const vendorId = req.userId;
    const { period = 'all', startDate, endDate } = req.query;

    const dateFilter = {};
    const now = new Date();

    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter.$gte = startOfDay;
    } else if (period === 'week') {
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
      dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
    } else if (period === 'year') {
      dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    if (startDate || endDate) {
      delete dateFilter.$gte;
      dateFilter.$gte = startDate ? new Date(startDate) : new Date('1970-01-01');
      dateFilter.$lte = endDate ? new Date(endDate) : new Date();
    }

    const matchStage = {
      'items.sellerId': vendorId
    };

    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    const revenuePipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': vendorId } },
      {
        $group: {
          _id: null,
          grossRevenue: { $sum: '$items.subtotal' },
          totalOrders: { $addToSet: '$_id' },
          totalItems: { $sum: '$items.quantity' }
        }
      },
      {
        $project: {
          grossRevenue: 1,
          totalOrders: { $size: '$totalOrders' },
          totalItems: 1
        }
      }
    ];

    const revenueResult = await Order.aggregate(revenuePipeline);

    const grossRevenue = revenueResult[0]?.grossRevenue || 0;
    const totalOrdersCount = revenueResult[0]?.totalOrders || 0;
    const totalItemsSold = revenueResult[0]?.totalItems || 0;
    const commission = grossRevenue * PLATFORM_COMMISSION_RATE;
    const netEarnings = grossRevenue - commission;

    const deliveryPipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': vendorId } },
      { $group: { _id: '$items.status', count: { $sum: 1 } } }
    ];

    const deliveryResult = await Order.aggregate(deliveryPipeline);

    const orderStats = deliveryResult.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const successfulDeliveries = orderStats.delivered || 0;
    const cancelledOrders = orderStats.cancelled || 0;
    const pendingOrders = orderStats.pending || 0;
    const processingOrders = orderStats.processing || 0;
    const shippedOrders = orderStats.shipped || 0;

    const topProductPipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': vendorId } },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.name' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails'
        }
      },
      { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          name: 1,
          totalSold: 1,
          totalRevenue: 1,
          currentStock: { $ifNull: ['$productDetails.inventory.quantity', 0] },
          image: { $arrayElemAt: ['$productDetails.images.url', 0] }
        }
      }
    ];

    const topProductResult = await Order.aggregate(topProductPipeline);
    const topProduct = topProductResult[0] || null;

    const lowStockPipeline = [
      { $match: { sellerId: vendorId } },
      { $match: { $expr: { $lte: ['$inventory.quantity', 5] } } },
      {
        $project: {
          _id: 1,
          name: 1,
          brand: 1,
          partNumber: 1,
          stockQuantity: '$inventory.quantity',
          reorderLevel: '$inventory.reorderLevel',
          publicPrice: '$pricing.publicPrice',
          status: { $cond: [{ $eq: ['$inventory.quantity', 0] }, 'Out of Stock', 'Low Stock'] }
        }
      },
      { $sort: { stockQuantity: 1 } }
    ];

    const lowStockProducts = await Product.aggregate(lowStockPipeline);

    const categoryRevenuePipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': vendorId } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          revenue: { $sum: '$items.subtotal' },
          quantity: { $sum: '$items.quantity' }
        }
      },
      { $sort: { revenue: -1 } }
    ];

    const categoryRevenue = await Order.aggregate(categoryRevenuePipeline);

    const monthlyRevenuePipeline = [
      { $match: matchStage },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': vendorId } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$items.subtotal' },
          orders: { $addToSet: '$_id' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          revenue: 1,
          orderCount: { $size: '$orders' }
        }
      }
    ];

    const monthlyRevenue = await Order.aggregate(monthlyRevenuePipeline);

    res.status(200).json({
      success: true,
      data: {
        revenue: {
          grossRevenue: Math.round(grossRevenue * 100) / 100,
          commissionRate: PLATFORM_COMMISSION_RATE * 100 + '%',
          commissionAmount: Math.round(commission * 100) / 100,
          netEarnings: Math.round(netEarnings * 100) / 100,
          currency: 'USD'
        },
        orders: {
          totalOrders: totalOrdersCount,
          successfulDeliveries,
          cancelledOrders,
          pendingOrders,
          processingOrders,
          shippedOrders,
          deliveryRate: totalOrdersCount > 0 
            ? Math.round((successfulDeliveries / totalOrdersCount) * 100 * 100) / 100 
            : 0
        },
        topProduct: topProduct ? {
          ...topProduct,
          totalSold: topProduct.totalSold,
          totalRevenue: Math.round(topProduct.totalRevenue * 100) / 100
        } : null,
        lowStockAlerts: {
          count: lowStockProducts.length,
          products: lowStockProducts.map(p => ({
            _id: p._id,
            name: p.name,
            brand: p.brand,
            partNumber: p.partNumber,
            currentStock: p.stockQuantity,
            reorderLevel: p.reorderLevel,
            price: p.publicPrice,
            status: p.status
          }))
        },
        categoryBreakdown: categoryRevenue.map(c => ({
          category: c._id || 'uncategorized',
          revenue: Math.round(c.revenue * 100) / 100,
          quantitySold: c.quantity
        })),
        monthlyRevenue: monthlyRevenue.map(m => ({
          year: m.year,
          month: m.month,
          revenue: Math.round(m.revenue * 100) / 100,
          orderCount: m.orderCount
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

const getQuickStats = async (req, res, next) => {
  try {
    const vendorId = req.userId;

    const quickStats = await Order.aggregate([
      { $match: { 'items.sellerId': vendorId } },
      { $unwind: '$items' },
      { $match: { 'items.sellerId': vendorId } },
      {
        $group: {
          _id: null,
          todayRevenue: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
                '$items.subtotal',
                0
              ]
            }
          },
          weekRevenue: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                '$items.subtotal',
                0
              ]
            }
          },
          monthRevenue: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                '$items.subtotal',
                0
              ]
            }
          }
        }
      }
    ]);

    const lowStockCount = await Product.countDocuments({
      sellerId: vendorId,
      $expr: { $lte: ['$inventory.quantity', 5] }
    });

    const activeProducts = await Product.countDocuments({
      sellerId: vendorId,
      isActive: true
    });

    res.status(200).json({
      success: true,
      data: {
        todayRevenue: Math.round((quickStats[0]?.todayRevenue || 0) * 100) / 100,
        weekRevenue: Math.round((quickStats[0]?.weekRevenue || 0) * 100) / 100,
        monthRevenue: Math.round((quickStats[0]?.monthRevenue || 0) * 100) / 100,
        lowStockCount,
        activeProducts,
        currency: 'USD'
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVendorAnalytics,
  getQuickStats
};