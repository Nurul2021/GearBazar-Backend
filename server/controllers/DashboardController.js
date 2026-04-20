/**
 * Dashboard Controller - Role-Based Summary Data using MongoDB Aggregations
 */

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { AppError } = require('../middleware/errorHandler');

const getDashboard = async (req, res, next) => {
  try {
    const userId = req.userId;
    const role = req.userRole;

    let dashboardData;

    switch (role) {
      case 'seller':
        dashboardData = await getSellerDashboard(userId);
        break;
      case 'garage':
        dashboardData = await getGarageDashboard(userId);
        break;
      case 'customer':
        dashboardData = await getCustomerDashboard(userId);
        break;
      case 'admin':
        dashboardData = await getAdminDashboard(userId);
        break;
      default:
        throw new AppError('Invalid user role', 400, 'INVALID_ROLE');
    }

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    next(error);
  }
};

const getSellerDashboard = async (userId) => {
  const sellerStats = await User.aggregate([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'vendorId',
        as: 'products'
      }
    },
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'vendorIds',
        as: 'orders'
      }
    },
    {
      $project: {
        totalProducts: { $size: '$products' },
        activeProducts: {
          $size: { $filter: { input: '$products', cond: { $eq: ['$$this.isActive', true] } } }
        },
        totalOrders: { $size: '$orders' }
      }
    }
  ]);

  const salesStats = await Order.aggregate([
    { $match: { sellerIds: userId } },
    { $unwind: '$items' },
    { $match: { 'items.sellerId': userId } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$items.subtotal' },
        totalItemsSold: { $sum: '$items.quantity' },
        totalOrders: { $addToSet: '$_id' }
      }
    },
    {
      $project: {
        totalSales: 1,
        totalItemsSold: 1,
        totalOrders: { $size: '$totalOrders' }
      }
    }
  ]);

  const pendingOrders = await Order.aggregate([
    { $match: { sellerIds: userId, status: { $in: ['pending', 'confirmed'] } } },
    {
      $project: {
        _id: 1,
        orderNumber: 1,
        status: 1,
        createdAt: 1,
        totalAmount: 1,
        items: {
          $filter: {
            input: '$items',
            cond: { $eq: ['$$this.sellerId', userId] }
          }
        }
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 10 }
  ]);

  return {
    role: 'seller',
    totalProducts: sellerStats[0]?.totalProducts || 0,
    activeProducts: sellerStats[0]?.activeProducts || 0,
    totalSales: salesStats[0]?.totalSales || 0,
    totalOrders: salesStats[0]?.totalOrders || 0,
    pendingOrders: pendingOrders.length,
    recentPendingOrders: pendingOrders
  };
};

const getGarageDashboard = async (userId) => {
  const user = await User.findById(userId).lean();

  const purchaseStats = await Order.aggregate([
    { $match: { customerId: userId } },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: '$totalAmount' },
        totalOrders: { $addToSet: '$_id' },
        totalItems: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        totalPurchases: 1,
        totalOrders: { $size: '$totalOrders' },
        totalItems: 1
      }
    }
  ]);

  const recentOrders = await Order.aggregate([
    { $match: { customerId: userId } },
    { $sort: { createdAt: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 1,
        orderNumber: 1,
        status: 1,
        totalAmount: 1,
        createdAt: 1,
        itemCount: { $size: '$items' }
      }
    }
  ]);

  const wishlistCount = 0;

  return {
    role: 'garage',
    verificationStatus: {
      isVerified: user.isVerified,
      isPendingVerification: user.isPendingVerification || false,
      shopDetails: user.shopDetails || {}
    },
    totalPartsPurchased: purchaseStats[0]?.totalItems || 0,
    totalPurchases: purchaseStats[0]?.totalPurchases || 0,
    totalOrders: purchaseStats[0]?.totalOrders || 0,
    wishlistCount,
    recentOrders
  };
};

const getCustomerDashboard = async (userId) => {
  const purchaseStats = await Order.aggregate([
    { $match: { customerId: userId } },
    { $unwind: '$items' },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: '$totalAmount' },
        totalOrders: { $addToSet: '$_id' },
        totalItems: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        totalSpent: 1,
        totalOrders: { $size: '$totalOrders' },
        totalItems: 1
      }
    }
  ]);

  const orderStatusBreakdown = await Order.aggregate([
    { $match: { customerId: userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const recentOrders = await Order.aggregate([
    { $match: { customerId: userId } },
    { $sort: { createdAt: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 1,
        orderNumber: 1,
        status: 1,
        totalAmount: 1,
        createdAt: 1,
        itemCount: { $size: '$items' }
      }
    }
  ]);

  const wishlistCount = 0;

  return {
    role: 'customer',
    totalOrders: purchaseStats[0]?.totalOrders || 0,
    totalSpent: purchaseStats[0]?.totalSpent || 0,
    totalItemsPurchased: purchaseStats[0]?.totalItems || 0,
    wishlistCount,
    orderStatusBreakdown: orderStatusBreakdown.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {}),
    recentOrders
  };
};

const getAdminDashboard = async (userId) => {
  const userStats = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);

  const verifiedStats = await User.aggregate([
    {
      $group: {
        _id: '$isVerified',
        count: { $sum: 1 }
      }
    }
  ]);

  const productStats = await Product.aggregate([
    {
      $group: {
        _id: '$isActive',
        count: { $sum: 1 }
      }
    }
  ]);

  const orderStats = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' }
      }
    }
  ]);

  const totalRevenue = await Order.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' }
      }
    }
  ]);

  const pendingVerifications = await User.countDocuments({
    isPendingVerification: true
  });

  const recentOrders = await Order.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 1,
        orderNumber: 1,
        status: 1,
        totalAmount: 1,
        createdAt: 1,
        customerId: 1
      }
    }
  ]);

  return {
    role: 'admin',
    users: {
      total: userStats.reduce((sum, s) => sum + s.count, 0),
      byRole: userStats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      verified: verifiedStats.find(s => s._id === true)?.count || 0,
      pending: pendingVerifications
    },
    products: {
      total: productStats.reduce((sum, s) => sum + s.count, 0),
      active: productStats.find(s => s._id === true)?.count || 0,
      inactive: productStats.find(s => s._id === false)?.count || 0
    },
    orders: {
      total: orderStats.reduce((sum, s) => sum + s.count, 0),
      byStatus: orderStats.reduce((acc, curr) => {
        acc[curr._id] = { count: curr.count, revenue: curr.totalRevenue };
        return acc;
      }, {}),
      totalRevenue: totalRevenue[0]?.total || 0
    },
    recentOrders
  };
};

module.exports = {
  getDashboard,
  getSellerDashboard,
  getGarageDashboard,
  getCustomerDashboard,
  getAdminDashboard
};