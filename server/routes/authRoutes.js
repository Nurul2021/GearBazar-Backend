/**
 * Auth Routes
 */

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config");

/* Login */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: "30d" },
    );

    res.json({
      success: true,
      data: { token, user: user.toJSON() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Register */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: role || "customer",
    });

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: "30d" },
    );

    res.status(201).json({
      success: true,
      data: { token, user: user.toJSON() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Admin Login */
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid admin credentials",
      });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid admin credentials",
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: "30d" },
    );

    res.json({
      success: true,
      data: { token, user: user.toJSON() },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* Get Current User */
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
});

module.exports = router;
