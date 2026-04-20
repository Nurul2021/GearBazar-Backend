/**
 * System Log Controller - Admin Activity Audit Trail
 */

const SystemLog = require("../models/SystemLog");

const createLog = async (req, res, next) => {
  try {
    const log = await SystemLog.log({
      adminId: req.user._id,
      adminName: req.user.name || req.user.email,
      action: req.body.action,
      targetType: req.body.targetType,
      targetId: req.body.targetId,
      targetName: req.body.targetName,
      description: req.body.description,
      previousValue: req.body.previousValue,
      newValue: req.body.newValue,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      status: req.body.status,
      errorMessage: req.body.errorMessage,
    });

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

const getLogs = async (req, res, next) => {
  try {
    const {
      action,
      adminId,
      targetType,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};
    if (action) query.action = action;
    if (adminId) query.adminId = adminId;
    if (targetType) query.targetType = targetType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await SystemLog.find(query)
      .populate("adminId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SystemLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        logs,
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

const getLogsByAdmin = async (req, res, next) => {
  try {
    const { adminId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const logs = await SystemLog.find({ adminId })
      .populate("adminId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SystemLog.countDocuments({ adminId });

    res.status(200).json({
      success: true,
      data: {
        logs,
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

const getLogStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const actionStats = await SystemLog.aggregate([
      { $match: matchStage },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const adminStats = await SystemLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$adminId",
          adminName: { $first: "$adminName" },
          actionCount: { $sum: 1 },
        },
      },
      { $sort: { actionCount: -1 } },
      { $limit: 10 },
    ]);

    const statusStats = await SystemLog.aggregate([
      { $match: matchStage },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const recentLogs = await SystemLog.find(matchStage)
      .populate("adminId", "name email")
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        actionStats: actionStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        adminStats,
        statusStats: statusStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getLogById = async (req, res, next) => {
  try {
    const { logId } = req.params;

    const log = await SystemLog.findById(logId).populate(
      "adminId",
      "name email",
    );

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Log not found",
      });
    }

    res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLog,
  getLogs,
  getLogsByAdmin,
  getLogStats,
  getLogById,
};
