/**
 * Search Routes - Advanced Product Search API
 */

const express = require("express");
const router = express.Router();

const { requireAuth, optionalAuth } = require("../middleware/auth");
const { isAdmin } = require("../middleware/roleMiddleware");

const SearchController = require("../controllers/SearchController");

router.get("/", SearchController.searchProducts);

router.get("/suggestions", SearchController.getSearchSuggestions);

router.get("/popular", SearchController.getPopularSearches);

router.get("/filters", SearchController.getSearchFilters);

router.get("/barcode/:barcode", SearchController.searchByBarcode);

module.exports = router;
