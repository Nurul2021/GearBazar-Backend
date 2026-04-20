/**
 * Create Admin User Script
 * Run: node backend/scripts/createAdmin.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../server/models/User");

const adminUser = {
  name: "Admin",
  email: "admin@gearbazar.com",
  password: "admin123",
  role: "admin",
  isActive: true,
  isVerified: true,
  phone: "+1-800-GEARBAZAR",
  country: "USA",
};

async function createAdmin() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/gearbazar",
    );

    const existingAdmin = await User.findOne({ email: adminUser.email });

    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email);
      console.log("Role:", existingAdmin.role);
    } else {
      const hashedPassword = await bcrypt.hash(adminUser.password, 12);

      const user = new User({
        ...adminUser,
        password: hashedPassword,
      });

      await user.save();
      console.log("Admin user created successfully!");
    }

    console.log("\nLogin credentials:");
    console.log("Email:", adminUser.email);
    console.log("Password:", adminUser.password);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

createAdmin();
