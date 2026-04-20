/**
 * Verification Controller - Admin & Vendor Operations
 */

const User = require("../models/User");
const VerificationDocument = require("../models/VerificationDocument");
const { AppError } = require("../middleware/errorHandler");

const getMyDocuments = async (req, res, next) => {
  try {
    const userId = req.userId;

    const documents = await VerificationDocument.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { type } = req.body;

    if (!req.file) {
      throw new AppError("File is required", 400, "VALIDATION_ERROR");
    }

    const existingDoc = await VerificationDocument.findOne({
      userId,
      type,
      status: { $in: ["pending", "approved"] },
    });

    if (existingDoc && existingDoc.status === "approved") {
      throw new AppError(
        "Approved documents cannot be replaced. Contact support.",
        400,
        "INVALID_STATE",
      );
    }

    let fileUrl = req.file.path || req.file.url;
    if (req.file.cloudinaryUrl) {
      fileUrl = req.file.cloudinaryUrl;
    }

    const document = await VerificationDocument.findOneAndUpdate(
      { userId, type },
      {
        userId,
        type,
        fileName: req.file.filename || req.file.originalname,
        originalName: req.file.originalname,
        fileUrl,
        publicId: req.file.public_id || null,
        mimeType: req.file.mimetype,
        size: req.file.size,
        status: "pending",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
      },
      { upsert: true, new: true },
    );

    const allDocs = await VerificationDocument.find({ userId });
    const requiredTypes = ["trade_license", "nid"];
    const hasRequired = requiredTypes.every((t) =>
      allDocs.some((d) => d.type === t && d.status === "approved"),
    );

    if (hasRequired) {
      await User.findByIdAndUpdate(userId, { isPendingVerification: true });
    }

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

const approveDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const adminId = req.userId;

    const document = await VerificationDocument.findById(documentId);
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    document.status = "approved";
    document.rejectionReason = null;
    document.reviewedBy = adminId;
    document.reviewedAt = new Date();
    await document.save();

    const allDocs = await VerificationDocument.find({
      userId: document.userId,
      status: "approved",
    });

    const requiredTypes = ["trade_license", "nid"];
    const allRequired = requiredTypes.every((t) =>
      allDocs.some((d) => d.type === t),
    );

    if (allRequired) {
      await User.findByIdAndUpdate(document.userId, {
        isVerified: true,
        isPendingVerification: false,
        verificationApprovedAt: new Date(),
        verificationApprovedBy: adminId,
      });
    }

    res.status(200).json({
      success: true,
      message: "Document approved",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

const rejectDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { reason } = req.body;
    const adminId = req.userId;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw new AppError(
        "Rejection reason is required",
        400,
        "VALIDATION_ERROR",
      );
    }

    const document = await VerificationDocument.findById(documentId);
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    document.status = "rejected";
    document.rejectionReason = reason.trim();
    document.reviewedBy = adminId;
    document.reviewedAt = new Date();
    await document.save();

    res.status(200).json({
      success: true,
      message: "Document rejected",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

const getAllPendingVerifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ isPendingVerification: true })
        .select("-password -verificationToken -resetPasswordToken")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments({ isPendingVerification: true }),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const approveUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    if (!user.isPendingVerification) {
      throw new AppError(
        "User is not pending verification",
        400,
        "INVALID_STATE",
      );
    }

    user.isVerified = true;
    user.isPendingVerification = false;
    user.verificationApprovedAt = new Date();
    user.verificationApprovedBy = req.userId;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User verification approved successfully",
      data: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

const rejectUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      throw new AppError(
        "Rejection reason is required",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (reason.length > 500) {
      throw new AppError(
        "Rejection reason cannot exceed 500 characters",
        400,
        "VALIDATION_ERROR",
      );
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

    if (!user.isPendingVerification) {
      throw new AppError(
        "User is not pending verification",
        400,
        "INVALID_STATE",
      );
    }

    user.isPendingVerification = false;
    user.rejectionReason = reason.trim();
    user.rejectionDate = new Date();
    user.rejectedBy = req.userId;
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: "User verification rejected",
      data: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        rejectionReason: user.rejectionReason,
        rejectedAt: user.rejectionDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyDocuments,
  uploadDocument,
  approveDocument,
  rejectDocument,
  getAllPendingVerifications,
  approveUser,
  rejectUser,
};
