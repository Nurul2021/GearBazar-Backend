/**
 * Seed Products Script
 * Run: node backend/scripts/seedProducts.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("../server/models/Product");
const User = require("../server/models/User");
const Category = require("../server/models/Category");

const categories = [
  { name: "Brakes", icon: "disc" },
  { name: "Filters", icon: "filter" },
  { name: "Ignition", icon: "zap" },
  { name: "Electrical", icon: "battery" },
  { name: "Engine", icon: "settings" },
  { name: "Suspension", icon: "activity" },
];

const products = [
  {
    title: "Brembo Premium Brake Caliper Front",
    brand: "Brembo",
    description:
      "Premium ceramic brake caliper for front wheels. High performance.",
    pricing: { publicPrice: 189.99, wholesalePrice: 145.0, currency: "USD" },
    inventory: { stockQuantity: 50, sku: "BRM-CAL-F" },
    images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400"],
    isFeatured: true,
  },
  {
    title: "Monroe Shock Absorber Set",
    brand: "Monroe",
    description: "Complete shock absorber set for smooth ride.",
    pricing: { publicPrice: 129.99, wholesalePrice: 99.0, currency: "USD" },
    inventory: { stockQuantity: 35, sku: "MON-SHK-S" },
    images: [
      "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=400",
    ],
    isFeatured: true,
  },
  {
    title: "Bosch Alternator 150A",
    brand: "Bosch",
    description: "High-output 150A alternator for reliable charging.",
    pricing: { publicPrice: 249.99, wholesalePrice: 199.0, currency: "USD" },
    inventory: { stockQuantity: 20, sku: "BOS-ALT-150" },
    images: ["https://images.unsplash.com/photo-1552975383-513c7002d408?w=400"],
    isFeatured: true,
  },
  {
    title: "NGK Iridium Spark Plugs (4pc)",
    brand: "NGK",
    description: "Premium iridium spark plugs for optimal ignition.",
    pricing: { publicPrice: 59.99, wholesalePrice: 45.0, currency: "USD" },
    inventory: { stockQuantity: 100, sku: "NGK-SPK-4" },
    images: [
      "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=400",
    ],
    isFeatured: true,
  },
  {
    title: "Castrol Edge Motor Oil 5W-30",
    brand: "Castrol",
    description: "Full synthetic motor oil for maximum protection.",
    pricing: { publicPrice: 34.99, wholesalePrice: 26.0, currency: "USD" },
    inventory: { stockQuantity: 200, sku: "CAS-EDGE-5W" },
    images: [
      "https://images.unsplash.com/photo-1506368242239-9d49a5466f7a?w=400",
    ],
    isFeatured: true,
  },
];

async function seedProducts() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/gearbazar",
    );

    // Find or create admin
    let admin = await User.findOne({ role: "admin" });
    if (!admin) {
      admin = await User.create({
        name: "GearBazar Admin",
        email: "admin@gearbazar.com",
        password: "admin123",
        role: "admin",
        isVerified: true,
      });
    }

    // Create categories
    const savedCategories = [];
    for (const cat of categories) {
      let existing = await Category.findOne({ name: cat.name });
      if (!existing) {
        existing = await Category.create(cat);
      }
      savedCategories.push(existing);
    }

    // Clear existing products
    await Product.deleteMany({});

    // Add products with category and generate slug
    const productsWithData = products.map((p, i) => {
      const slug =
        p.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Date.now();
      return {
        ...p,
        slug,
        vendorId: admin._id,
        category: savedCategories[i % savedCategories.length]._id,
      };
    });

    await Product.insertMany(productsWithData);
    console.log(
      `✓ Seeded ${products.length} products and ${categories.length} categories`,
    );

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

seedProducts();
