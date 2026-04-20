/**
 * Finance Management Controller - Admin & Vendor Operations
 */

const Order = require('../models/Order');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const FinanceSettings = require('../models/FinanceSettings');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { AppError } = require('../middleware/errorHandler');

const getCommissionSettings = async (req, res, next) => {
  try {
    let settings = await FinanceSettings.findOne();
    
    if (!settings) {
      settings = await FinanceSettings.create({ commissionPercentage: 10 });
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

const updateCommissionSettings = async (req, res, next) => {
  try {
    const { commissionPercentage, minimumWithdrawalAmount, withdrawalProcessingDays } = req.body;

    if (commissionPercentage !== undefined) {
      if (commissionPercentage < 0 || commissionPercentage > 100) {
        throw new AppError('Commission must be between 0 and 100', 400, 'INVALID_COMMISSION');
      }
    }

    let settings = await FinanceSettings.findOne();
    
    if (settings) {
      if (commissionPercentage !== undefined) settings.commissionPercentage = commissionPercentage;
      if (minimumWithdrawalAmount !== undefined) settings.minimumWithdrawalAmount = minimumWithdrawalAmount;
      if (withdrawalProcessingDays !== undefined) settings.withdrawalProcessingDays = withdrawalProcessingDays;
      settings.updatedBy = req.userId;
      settings.updatedAt = new Date();
      await settings.save();
    } else {
      settings = await FinanceSettings.create({
        commissionPercentage: commissionPercentage || 10,
        minimumWithdrawalAmount: minimumWithdrawalAmount || 100,
        withdrawalProcessingDays: withdrawalProcessingDays || 3,
        updatedBy: req.userId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Commission settings updated',
      data: settings
    });
  } catch (error) {
    next(error);
  }
};

const createWithdrawalRequest = async (req, res, next) => {
  try {
    const vendorId = req.userId;
    const { amount, paymentMethod, bankDetails, mobileAccount } = req.body;

    const settings = await FinanceSettings.findOne() || await FinanceSettings.create({});

    if (amount < settings.minimumWithdrawalAmount) {
      throw new AppError(`Minimum withdrawal amount is ${settings.minimumWithdrawalAmount}`, 400, 'MIN_WITHDRAWAL');
    }

    const vendor = await User.findById(vendorId);
    if (!vendor) {
      throw new AppError('Vendor not found', 404, 'NOT_FOUND');
    }

    const earnings = await calculateVendorEarnings(vendorId);
    if (amount > earnings.available) {
      throw new AppError('Insufficient earnings', 400, 'INSUFFICIENT_BALANCE');
    }

    if (!paymentMethod || !['bank_transfer', 'bkash', 'nagad'].includes(paymentMethod)) {
      throw new AppError('Valid payment method required', 400, 'INVALID_PAYMENT_METHOD');
    }

    const withdrawal = await Withdrawal.create({
      vendorId,
      amount,
      paymentMethod,
      bankDetails: paymentMethod === 'bank_transfer' ? bankDetails : undefined,
      mobileAccount: ['bkash', 'nagad'].includes(paymentMethod) ? mobileAccount : undefined
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted',
      data: withdrawal
    });
  } catch (error) {
    next(error);
  }
};

const getVendorEarnings = async (req, res, next) => {
  try {
    const vendorId = req.userId;
    const earnings = await calculateVendorEarnings(vendorId);

    res.status(200).json({
      success: true,
      data: earnings
    });
  } catch (error) {
    next(error);
  }
};

const calculateVendorEarnings = async (vendorId) => {
  const settings = await FinanceSettings.findOne() || { commissionPercentage: 10 };
  const commissionRate = settings.commissionPercentage / 100;

  const salesPipeline = await Order.aggregate([
    { $match: { 'orderItems.vendorId': vendorId, paymentStatus: 'paid', orderStatus: { $in: ['delivered', 'completed'] } } },
    { $unwind: '$orderItems' },
    { $match: { 'orderItems.vendorId': vendorId } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$orderItems.subtotal' },
        totalOrders: { $addToSet: '$_id' }
      }
    },
    {
      $project: {
        totalSales: 1,
        totalOrders: { $size: '$totalOrders' }
      }
    }
  ]);

  const pendingPipeline = await Order.aggregate([
    { $match: { 'orderItems.vendorId': vendorId, paymentStatus: 'paid', orderStatus: { $in: ['pending', 'confirmed', 'processing', 'shipped'] } } },
    { $unwind: '$orderItems' },
    { $match: { 'orderItems.vendorId': vendorId } },
    {
      $group: {
        _id: null,
        pendingAmount: { $sum: '$orderItems.subtotal' }
      }
    }
  ]);

  const withdrawnPipeline = await Withdrawal.aggregate([
    { $match: { vendorId, status: { $in: ['completed'] } } },
    { $group: { _id: null, totalWithdrawn: { $sum: '$amount' } } }
  ]);

  const totalSales = salesPipeline[0]?.totalSales || 0;
  const pendingAmount = pendingPipeline[0]?.pendingAmount || 0;
  const totalWithdrawn = withdrawnPipeline[0]?.totalWithdrawn || 0;
  const totalCommission = totalSales * commissionRate;
  const netEarnings = totalSales - totalCommission;
  const available = netEarnings - totalWithdrawn;

  return {
    totalSales,
    totalCommission,
    netEarnings,
    totalWithdrawn,
    pendingAmount,
    available,
    totalOrders: salesPipeline[0]?.totalOrders || 0
  };
};

const getAllWithdrawalRequests = async (req, res, next) => {
  try {
    const { status, vendorId, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (vendorId) query.vendorId = vendorId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('vendorId', 'name email shopDetails')
        .populate('processedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Withdrawal.countDocuments(query)
    ]);

    const stats = await Withdrawal.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: stats.reduce((acc, curr) => {
          acc[curr._id] = { count: curr.count, amount: curr.totalAmount };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
};

const processWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, transactionId, rejectionReason, notes } = req.body;

    const withdrawal = await Withdrawal.findById(id).populate('vendorId', 'name email');

    if (!withdrawal) {
      throw new AppError('Withdrawal request not found', 404, 'NOT_FOUND');
    }

    if (withdrawal.status !== 'pending') {
      throw new AppError('Withdrawal is not in pending status', 400, 'INVALID_STATUS');
    }

    if (action === 'approve' || action === 'process') {
      if (!transactionId) {
        throw new AppError('Transaction ID is required', 400, 'TRANSACTION_REQUIRED');
      }

      withdrawal.status = 'completed';
      withdrawal.transactionId = transactionId;
      withdrawal.processedAt = new Date();
      withdrawal.processedBy = req.userId;
      if (notes) withdrawal.notes = notes;

      await withdrawal.save();

      return res.status(200).json({
        success: true,
        message: 'Withdrawal approved and completed',
        data: withdrawal
      });
    } else if (action === 'reject') {
      if (!rejectionReason) {
        throw new AppError('Rejection reason is required', 400, 'REASON_REQUIRED');
      }

      withdrawal.status = 'rejected';
      withdrawal.rejectionReason = rejectionReason;
      withdrawal.processedAt = new Date();
      withdrawal.processedBy = req.userId;
      if (notes) withdrawal.notes = notes;

      await withdrawal.save();

      return res.status(200).json({
        success: true,
        message: 'Withdrawal rejected',
        data: withdrawal
      });
    } else if (action === 'processing') {
      withdrawal.status = 'processing';
      withdrawal.processedBy = req.userId;
      if (notes) withdrawal.notes = notes;
      await withdrawal.save();

      return res.status(200).json({
        success: true,
        message: 'Withdrawal marked as processing',
        data: withdrawal
      });
    } else {
      throw new AppError('Invalid action', 400, 'INVALID_ACTION');
    }
  } catch (error) {
    next(error);
  }
};

const getMonthlySalesReport = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const currentYear = parseInt(year) || new Date().getFullYear();
    const currentMonth = parseInt(month) || new Date().getMonth() + 1;

    const startDate = new Date(currentYear, currentMonth - 1, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const settings = await FinanceSettings.findOne() || { commissionPercentage: 10 };
    const commissionRate = settings.commissionPercentage / 100;

    const salesByCategory = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$orderItems' },
      {
        $lookup: {
          from: 'products',
          localField: 'orderItems.product',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          totalRevenue: { $sum: '$orderItems.subtotal' },
          totalOrders: { $addToSet: '$_id' },
          totalQuantity: { $sum: '$orderItems.quantity' },
          platformEarnings: {
            $sum: { $multiply: ['$orderItems.subtotal', commissionRate] }
          },
          vendorEarnings: {
            $sum: { $multiply: ['$orderItems.subtotal', { $subtract: [1, commissionRate] }] }
          }
        }
      },
      {
        $project: {
          category: '$_id',
          totalRevenue: 1,
          totalOrders: { $size: '$totalOrders' },
          totalQuantity: 1,
          platformEarnings: 1,
          vendorEarnings: 1,
          _id: 0
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryName: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
          categorySlug: { $ifNull: ['$categoryInfo.slug', 'uncategorized'] },
          totalRevenue: 1,
          totalOrders: 1,
          totalQuantity: 1,
          platformEarnings: 1,
          vendorEarnings: 1
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    const overallStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$orderItems.subtotal' },
          totalOrders: { $addToSet: '$_id' },
          totalQuantity: { $sum: '$orderItems.quantity' },
          platformEarnings: {
            $sum: { $multiply: ['$orderItems.subtotal', commissionRate] }
          },
          vendorEarnings: {
            $sum: { $multiply: ['$orderItems.subtotal', { $subtract: [1, commissionRate] }] }
          }
        }
      },
      {
        $project: {
          totalRevenue: 1,
          totalOrders: { $size: '$totalOrders' },
          totalQuantity: 1,
          platformEarnings: 1,
          vendorEarnings: 1,
          _id: 0
        }
      }
    ]);

    const topProducts = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.product',
          productTitle: { $first: '$orderItems.title' },
          totalRevenue: { $sum: '$orderItems.subtotal' },
          totalQuantity: { $sum: '$orderItems.quantity' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productTitle: 1,
          totalRevenue: 1,
          totalQuantity: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: { year: currentYear, month: currentMonth, monthName: new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' }) },
        summary: overallStats[0] || { totalRevenue: 0, totalOrders: 0, totalQuantity: 0, platformEarnings: 0, vendorEarnings: 0 },
        salesByCategory,
        topProducts,
        commissionPercentage: settings.commissionPercentage
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPlatformEarnings = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    
    let start, end;
    const now = new Date();

    if (period === 'today') {
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
    } else if (period === 'week') {
      start = new Date(now.setDate(now.getDate() - 7));
      end = new Date();
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    } else if (period === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date();
    } else if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    }

    const settings = await FinanceSettings.findOne() || { commissionPercentage: 10 };
    const commissionRate = settings.commissionPercentage / 100;

    const platformEarningsData = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: start, $lte: end }
        }
      },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$orderItems.subtotal' },
          platformEarnings: { $sum: { $multiply: ['$orderItems.subtotal', commissionRate] } },
          vendorEarnings: { $sum: { $multiply: ['$orderItems.subtotal', { $subtract: [1, commissionRate] }] } },
          totalOrders: { $addToSet: '$_id' },
          totalQuantity: { $sum: '$orderItems.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          platformEarnings: 1,
          vendorEarnings: 1,
          totalOrders: { $size: '$totalOrders' },
          totalQuantity: 1
        }
      }
    ]);

    const completedWithdrawals = await Withdrawal.aggregate([
      { $match: { status: 'completed', processedAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
    ]);

    const pendingWithdrawals = await Withdrawal.aggregate([
      { $match: { status: { $in: ['pending', 'processing'] } } },
      { $group: { _id: null, totalPending: { $sum: '$amount' } } }
    ]);

    const stats = platformEarningsData[0] || { totalRevenue: 0, platformEarnings: 0, vendorEarnings: 0, totalOrders: 0, totalQuantity: 0 };

    res.status(200).json({
      success: true,
      data: {
        period: { start, end, period: period || 'custom' },
        commissionPercentage: settings.commissionPercentage,
        revenue: stats.totalRevenue,
        platformEarnings: stats.platformEarnings,
        vendorEarnings: stats.vendorEarnings,
        totalOrders: stats.totalOrders,
        totalQuantity: stats.totalQuantity,
        totalWithdrawn: completedWithdrawals[0]?.totalPaid || 0,
        pendingWithdrawals: pendingWithdrawals[0]?.totalPending || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

const getVendorWithdrawalHistory = async (req, res, next) => {
  try {
    const vendorId = req.userId;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ vendorId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Withdrawal.countDocuments({ vendorId })
    ]);

    const stats = await Withdrawal.aggregate([
      { $match: { vendorId } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        stats: stats.reduce((acc, curr) => {
          acc[curr._id] = { count: curr.count, amount: curr.totalAmount };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommissionSettings,
  updateCommissionSettings,
  createWithdrawalRequest,
  getVendorEarnings,
  getAllWithdrawalRequests,
  processWithdrawal,
  getMonthlySalesReport,
  getPlatformEarnings,
  getVendorWithdrawalHistory,
  calculateVendorEarnings
};
