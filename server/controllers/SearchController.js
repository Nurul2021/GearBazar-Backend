/**
 * Search Controller - Advanced Search API Endpoints
 */

const SearchService = require("../services/SearchService");

const searchProducts = async (req, res, next) => {
  try {
    const {
      query,
      category,
      brand,
      make,
      model,
      year,
      minPrice,
      maxPrice,
      inStock,
      page = 1,
      limit = 20,
      sort = "relevance",
    } = req.query;

    const filters = {
      query,
      category,
      brand,
      make,
      model,
      year,
      minPrice,
      maxPrice,
      inStock,
      page,
      limit,
    };

    const result = await SearchService.search(filters);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSearchSuggestions = async (req, res, next) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "Query must be at least 2 characters",
      });
    }

    const result = await SearchService.getSuggestions(query, parseInt(limit));

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getPopularSearches = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await SearchService.getPopularSearches(parseInt(limit));

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSearchFilters = async (req, res, next) => {
  try {
    const result = await SearchService.getFilters();

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const searchByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;

    const Product = require("../models/Product");
    const product = await Product.findOne({
      $or: [{ "inventory.sku": barcode }, { partNumber: barcode }],
      isActive: true,
    })
      .populate("category", "name slug")
      .populate("vendorId", "name shopName");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found with this barcode",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchProducts,
  getSearchSuggestions,
  getPopularSearches,
  getSearchFilters,
  searchByBarcode,
};
