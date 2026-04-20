/**
 * Product Routes - Simplified
 */

const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

/* Get All Products */
router.get("/", async (req, res) => {
  try {
    const {
      category,
      brand,
      search,
      page = 1,
      limit = 24,
      sort = "newest",
    } = req.query;

    const query = {};
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price-asc") sortOption = { publicPrice: 1 };
    if (sort === "price-desc") sortOption = { publicPrice: -1 };
    if (sort === "name-asc") sortOption = { title: 1 };
    if (sort === "name-desc") sortOption = { title: -1 };

    const products = await Product.find(query)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("vendorId", "name");

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/* Get Product by ID */
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "vendorId",
      "name",
    );
    if (!product) {
      return res.json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/* Get Featured Products */
router.get("/featured", async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true }).limit(10);
    res.json({ success: true, data: products });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

/* Get Categories */
router.get("/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json({ success: true, data: categories });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
