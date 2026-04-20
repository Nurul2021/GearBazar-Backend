/**
 * Withdrawal Controller - Vendor Withdrawal Requests
 */

const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const Order = require("../models/Order");
const FinanceSettings = require("../models/FinanceSettings");
const User = require("../models/User");

const getVendorBalance = async (vendorId) => {
  const settings = await FinanceSettings.findOne();
  const commissionPercentage = settings?.commissionPercentage || 10;

  const result = await Order.aggregate([
    {
      $match: {
        vendorIds: new mongoose.Types.ObjectId(vendorId),
        paymentStatus: "paid",
        orderStatus: {
          $in: ["delivered", "confirmed", "processing", "shipped"],
        },
      },
    },
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
        totalCommission: {
          $sum: {
            $multiply: ["$orderItems.subtotal", commissionPercentage / 100],
          },
        },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  if (result.length === 0) {
    return {
      totalSales: 0,
      totalCommission: 0,
      vendorEarnings: 0,
      availableBalance: 0,
    };
  }

  const { totalSales, totalCommission } = result[0];
  const vendorEarnings = totalSales - totalCommission;
  const paidWithdrawals = await Withdrawal.aggregate([
    {
      $match: {
        vendorId: new mongoose.Types.ObjectId(vendorId),
        status: { $in: ["completed", "processing"] },
      },
    },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: "$amount" },
      },
    },
  ]);

  const totalPaid = paidWithdrawals[0]?.totalPaid || 0;
  const availableBalance = Math.max(0, vendorEarnings - totalPaid);

  return {
    totalSales: Math.round(totalSales * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    vendorEarnings: Math.round(vendorEarnings * 100) / 100,
    availableBalance: Math.round(availableBalance * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
  };
};

const createWithdrawalRequest = async (req, res, next) => {
  try {
    const { amount, paymentMethod, bankDetails, mobileAccount } = req.body;
    const vendorId = req.user._id;

    const settings = await FinanceSettings.findOne();
    const minWithdrawal = settings?.minimumWithdrawalAmount || 100;

    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${minWithdrawal}`,
      });
    }

    const balance = await getVendorBalance(vendorId);
    if (amount > balance.availableBalance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
        availableBalance: balance.availableBalance,
      });
    }

    const withdrawal = await Withdrawal.create({
      vendorId,
      amount,
      paymentMethod,
      bankDetails,
      mobileAccount,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

const getVendorWithdrawals = async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { vendorId };
    if (status) {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Withdrawal.countDocuments(query);
    const balance = await getVendorBalance(vendorId);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        balance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getVendorBalanceInfo = async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const balance = await getVendorBalance(vendorId);

    res.status(200).json({
      success: true,
      data: balance,
    });
  } catch (error) {
    next(error);
  }
};

const getAllWithdrawals = async (req, res, next) => {
  try {
    const { status, vendorId, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (vendorId) {
      query.vendorId = vendorId;
    }

    const withdrawals = await Withdrawal.find(query)
      .populate("vendorId", "name email role")
      .populate("processedBy", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Withdrawal.countDocuments(query);
    const pendingCount = await Withdrawal.countDocuments({ status: "pending" });
    const processingCount = await Withdrawal.countDocuments({
      status: "processing",
    });
    const completedCount = await Withdrawal.countDocuments({
      status: "completed",
    });

    const statusSummary = {
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
    };

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
        statusSummary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { withdrawalId } = req.params;
    const { status, transactionId, rejectionReason, notes } = req.body;

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found",
      });
    }

    if (!["pending", "processing"].includes(withdrawal.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update this withdrawal request",
      });
    }

    withdrawal.status = status;
    withdrawal.processedBy = req.user._id;

    if (status === "processing") {
      withdrawal.processedAt = new Date();
    } else if (status === "completed") {
      withdrawal.transactionId = transactionId || `TXN-${Date.now()}`;
      withdrawal.processedAt = new Date();
    } else if (status === "rejected") {
      withdrawal.rejectionReason = rejectionReason;
    }

    if (notes) {
      withdrawal.notes = notes;
    }

    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: `Withdrawal marked as ${status}`,
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWithdrawalRequest,
  getVendorWithdrawals,
  getVendorBalanceInfo,
  getAllWithdrawals,
  updateWithdrawalStatus,
  getVendorBalance,
};
