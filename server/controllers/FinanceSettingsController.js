/**
 * Finance Settings Controller - Global Commission Management
 */

const FinanceSettings = require("../models/FinanceSettings");

const getSettings = async (req, res, next) => {
  try {
    let settings = await FinanceSettings.findOne();

    if (!settings) {
      settings = await FinanceSettings.create({
        commissionPercentage: 10,
        minimumWithdrawalAmount: 100,
        withdrawalProcessingDays: 3,
      });
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const {
      commissionPercentage,
      minimumWithdrawalAmount,
      withdrawalProcessingDays,
      paymentGateways,
    } = req.body;

    let settings = await FinanceSettings.findOne();

    if (settings) {
      if (commissionPercentage !== undefined) {
        settings.commissionPercentage = commissionPercentage;
      }
      if (minimumWithdrawalAmount !== undefined) {
        settings.minimumWithdrawalAmount = minimumWithdrawalAmount;
      }
      if (withdrawalProcessingDays !== undefined) {
        settings.withdrawalProcessingDays = withdrawalProcessingDays;
      }
      if (paymentGateways) {
        settings.paymentGateways = {
          ...settings.paymentGateways,
          ...paymentGateways,
        };
      }
      settings.updatedBy = req.user._id;
      settings.updatedAt = new Date();
      await settings.save();
    } else {
      settings = await FinanceSettings.create({
        commissionPercentage: commissionPercentage || 10,
        minimumWithdrawalAmount: minimumWithdrawalAmount || 100,
        withdrawalProcessingDays: withdrawalProcessingDays || 3,
        paymentGateways,
        updatedBy: req.user._id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Finance settings updated successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const getCommissionPercentage = async (req, res, next) => {
  try {
    const settings = await FinanceSettings.findOne();
    const commissionPercentage = settings ? settings.commissionPercentage : 10;

    res.status(200).json({
      success: true,
      data: { commissionPercentage },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getCommissionPercentage,
};
