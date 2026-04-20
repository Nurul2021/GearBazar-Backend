/**
 * Auth Controller - Login, Forgot Password, Reset Password
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");
const { generateResetToken, hashToken } = require("../utils/crypto");
const { sendEmail } = require("../utils/email/emailService");
const {
  getPasswordResetEmail,
  getPasswordResetConfirmationEmail,
} = require("../utils/email/templates");

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(
        "Email and password are required",
        400,
        "VALIDATION_ERROR",
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    if (!user.isActive) {
      throw new AppError(
        "Your account has been deactivated",
        403,
        "ACCOUNT_INACTIVE",
      );
    }

    if (user.role === "admin") {
      throw new AppError(
        "Admin users must login via admin portal",
        403,
        "ADMIN_FORBIDDEN",
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      config.jwtSecret,
      { expiresIn: "30d" },
    );

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const userProfile = user.toJSON();

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: userProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      throw new AppError(
        "Name, email, and password are required",
        400,
        "VALIDATION_ERROR",
      );
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError("Email already registered", 400, "EMAIL_EXISTS");
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: "customer",
      isActive: true,
    });

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      config.jwtSecret,
      { expiresIn: "30d" },
    );

    const userProfile = user.toJSON();

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        token,
        user: userProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError("Email is required", 400, "VALIDATION_ERROR");
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists, a password reset link will be sent",
      });
    }

    if (!user.isActive) {
      return res.status(200).json({
        success: true,
        message: "If an account exists, a password reset link will be sent",
      });
    }

    const { token, hashedToken, expiresAt } = generateResetToken();

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expiresAt;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    const emailHtml = getPasswordResetEmail(user.name, resetUrl, 30);
    await sendEmail(user.email, "🔐 Reset Your GearBazar Password", emailHtml);

    res.status(200).json({
      success: true,
      message: "If an account exists, a password reset link will be sent",
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, email, newPassword, confirmPassword } = req.body;

    if (!token || !email || !newPassword || !confirmPassword) {
      throw new AppError(
        "Token, email, and passwords are required",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (newPassword !== confirmPassword) {
      throw new AppError("Passwords do not match", 400, "PASSWORD_MISMATCH");
    }

    if (newPassword.length < 6) {
      throw new AppError(
        "Password must be at least 6 characters",
        400,
        "VALIDATION_ERROR",
      );
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      throw new AppError(
        "Invalid or expired reset token",
        400,
        "INVALID_TOKEN",
      );
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const emailHtml = getPasswordResetConfirmationEmail(user.name);
    await sendEmail(
      user.email,
      "✅ Your GearBazar Password Has Been Reset",
      emailHtml,
    );

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(
        "Email and password are required",
        400,
        "VALIDATION_ERROR",
      );
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    if (user.role !== "admin") {
      throw new AppError(
        "Invalid credentials for admin access",
        403,
        "FORBIDDEN",
      );
    }

    if (!user.isActive) {
      throw new AppError(
        "Your account has been deactivated",
        403,
        "ACCOUNT_INACTIVE",
      );
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError(
        "Invalid email or password",
        401,
        "INVALID_CREDENTIALS",
      );
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      config.jwtSecret,
      { expiresIn: "30d" },
    );

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const userProfile = user.toJSON();

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: {
        token,
        user: userProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getMe,
  forgotPassword,
  resetPassword,
  adminLogin,
};
