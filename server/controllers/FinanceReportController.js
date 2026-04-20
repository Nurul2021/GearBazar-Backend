/**
 * Finance Report Controller - Monthly Sales Reports by Category
 */

const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Category = require("../models/Category");
const FinanceSettings = require("../models/FinanceSettings");

const getMonthlySalesReport = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const settings = await FinanceSettings.findOne();
    const commissionPercentage = settings?.commissionPercentage || 10;

    const orderItemsAggregation = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: "paid",
          orderStatus: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$orderItems" },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$product.category",
          categoryName: { $first: "$category.name" },
          totalRevenue: { $sum: "$orderItems.subtotal" },
          totalQuantity: { $sum: "$orderItems.quantity" },
          orderCount: { $addToSet: "$_id" },
          vendorEarnings: {
            $sum: {
              $multiply: [
                "$orderItems.subtotal",
                (100 - commissionPercentage) / 100,
              ],
            },
          },
          platformEarnings: {
            $sum: {
              $multiply: ["$orderItems.subtotal", commissionPercentage / 100],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          categoryName: { $ifNull: ["$categoryName", "Uncategorized"] },
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalQuantity: { $round: ["$totalQuantity", 2] },
          orderCount: { $size: "$orderCount" },
          vendorEarnings: { $round: ["$vendorEarnings", 2] },
          platformEarnings: { $round: ["$platformEarnings", 2] },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    const summaryAggregation = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: "paid",
          orderStatus: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$orderItems.subtotal" },
          totalOrders: { $addToSet: "$_id" },
          totalItems: { $sum: "$orderItems.quantity" },
          totalPlatformEarnings: {
            $sum: {
              $multiply: ["$orderItems.subtotal", commissionPercentage / 100],
            },
          },
          totalVendorEarnings: {
            $sum: {
              $multiply: [
                "$orderItems.subtotal",
                (100 - commissionPercentage) / 100,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalOrders: { $size: "$totalOrders" },
          totalItems: { $round: ["$totalItems", 2] },
          totalPlatformEarnings: { $round: ["$totalPlatformEarnings", 2] },
          totalVendorEarnings: { $round: ["$totalVendorEarnings", 2] },
          commissionPercentage,
        },
      },
    ]);

    const summary = summaryAggregation[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      totalItems: 0,
      totalPlatformEarnings: 0,
      totalVendorEarnings: 0,
      commissionPercentage,
    };

    res.status(200).json({
      success: true,
      data: {
        period: {
          year: targetYear,
          month: targetMonth,
          monthName: new Date(targetYear, targetMonth - 1).toLocaleString(
            "default",
            { month: "long" },
          ),
        },
        summary,
        categoryBreakdown: orderItemsAggregation,
        commissionPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPlatformEarningsReport = async (req, res, next) => {
  try {
    const { startDate, endDate, vendorId } = req.query;

    const settings = await FinanceSettings.findOne();
    const commissionPercentage = settings?.commissionPercentage || 10;

    const matchConditions = {
      paymentStatus: "paid",
      orderStatus: { $nin: ["cancelled", "refunded"] },
    };

    if (startDate && endDate) {
      matchConditions.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (vendorId) {
      matchConditions.vendorIds = new mongoose.Types.ObjectId(vendorId);
    }

    const platformEarnings = await Order.aggregate([
      { $match: matchConditions },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.vendorId",
          totalSales: { $sum: "$orderItems.subtotal" },
          commission: {
            $sum: {
              $multiply: ["$orderItems.subtotal", commissionPercentage / 100],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          vendorId: "$_id",
          totalSales: { $round: ["$totalSales", 2] },
          platformEarnings: { $round: ["$commission", 2] },
          vendorEarnings: {
            $round: [{ $subtract: ["$totalSales", "$commission"] }, 2],
          },
        },
      },
    ]);

    const totals = platformEarnings.reduce(
      (acc, item) => ({
        totalSales: acc.totalSales + item.totalSales,
        platformEarnings: acc.platformEarnings + item.platformEarnings,
        vendorEarnings: acc.vendorEarnings + item.vendorEarnings,
      }),
      { totalSales: 0, platformEarnings: 0, vendorEarnings: 0 },
    );

    res.status(200).json({
      success: true,
      data: {
        vendorBreakdown: platformEarnings,
        totals: {
          ...totals,
          totalSales: Math.round(totals.totalSales * 100) / 100,
          platformEarnings: Math.round(totals.platformEarnings * 100) / 100,
          vendorEarnings: Math.round(totals.vendorEarnings * 100) / 100,
        },
        commissionPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getVendorEarningsReport = async (req, res, next) => {
  try {
    const vendorId = req.params.vendorId || req.user._id;
    const { startDate, endDate } = req.query;

    const settings = await FinanceSettings.findOne();
    const commissionPercentage = settings?.commissionPercentage || 10;

    const matchConditions = {
      vendorIds: new mongoose.Types.ObjectId(vendorId),
      paymentStatus: "paid",
      orderStatus: { $nin: ["cancelled", "refunded"] },
    };

    if (startDate && endDate) {
      matchConditions.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const earningsData = await Order.aggregate([
      { $match: matchConditions },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendorId": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$orderItems.subtotal" },
          totalOrders: { $addToSet: "$_id" },
          totalItems: { $sum: "$orderItems.quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $round: ["$totalSales", 2] },
          totalOrders: { $size: "$totalOrders" },
          totalItems: { $round: ["$totalItems", 2] },
          commissionPercentage,
          platformEarnings: {
            $round: [
              { $multiply: ["$totalSales", commissionPercentage / 100] },
              2,
            ],
          },
          vendorEarnings: {
            $round: [
              {
                $multiply: ["$totalSales", (100 - commissionPercentage) / 100],
              },
              2,
            ],
          },
        },
      },
    ]);

    const monthlyEarnings = await Order.aggregate([
      { $match: matchConditions },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendorId": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$orderItems.subtotal" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          totalSales: { $round: ["$totalSales", 2] },
        },
      },
    ]);

    const earnings = earningsData[0] || {
      totalSales: 0,
      totalOrders: 0,
      totalItems: 0,
      platformEarnings: 0,
      vendorEarnings: 0,
      commissionPercentage,
    };

    res.status(200).json({
      success: true,
      data: {
        summary: earnings,
        monthlyBreakdown: monthlyEarnings,
        commissionPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardSummary = async (req, res, next) => {
  try {
    const settings = await FinanceSettings.findOne();
    const commissionPercentage = settings?.commissionPercentage || 10;

    const allTimeStats = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          orderStatus: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$orderItems.subtotal" },
          platformEarnings: {
            $sum: {
              $multiply: ["$orderItems.subtotal", commissionPercentage / 100],
            },
          },
        },
      },
    ]);

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const currentMonthStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: currentMonthStart },
          paymentStatus: "paid",
          orderStatus: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$orderItems.subtotal" },
          platformEarnings: {
            $sum: {
              $multiply: ["$orderItems.subtotal", commissionPercentage / 100],
            },
          },
          orderCount: { $addToSet: "$_id" },
        },
      },
    ]);

    const lastMonthStart = new Date(currentMonthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthEnd = new Date(currentMonthStart);
    lastMonthEnd.setDate(0);

    const lastMonthStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
          paymentStatus: "paid",
          orderStatus: { $nin: ["cancelled", "refunded"] },
        },
      },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$orderItems.subtotal" },
        },
      },
    ]);

    const allTime = allTimeStats[0] || { totalRevenue: 0, platformEarnings: 0 };
    const currentMonth = currentMonthStats[0] || {
      totalRevenue: 0,
      platformEarnings: 0,
      orderCount: [],
    };
    const lastMonth = lastMonthStats[0] || { totalRevenue: 0 };

    const revenueGrowth =
      lastMonth.totalRevenue > 0
        ? ((currentMonth.totalRevenue - lastMonth.totalRevenue) /
            lastMonth.totalRevenue) *
          100
        : 0;

    res.status(200).json({
      success: true,
      data: {
        allTime: {
          totalRevenue: Math.round(allTime.totalRevenue * 100) / 100,
          platformEarnings: Math.round(allTime.platformEarnings * 100) / 100,
        },
        currentMonth: {
          totalRevenue: Math.round(currentMonth.totalRevenue * 100) / 100,
          platformEarnings:
            Math.round(currentMonth.platformEarnings * 100) / 100,
          orderCount: currentMonth.orderCount.length,
        },
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        commissionPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMonthlySalesReport,
  getPlatformEarningsReport,
  getVendorEarningsReport,
  getDashboardSummary,
};
