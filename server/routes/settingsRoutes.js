/**
 * Settings Routes - Global Site Configuration
 */

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { isAdmin } = require("../middleware/roleMiddleware");

const SettingsController = require("../controllers/SettingsController");

router.get("/", SettingsController.getSettings);

router.put("/", requireAuth, isAdmin, SettingsController.updateSettings);

router.put(
  "/maintenance",
  requireAuth,
  isAdmin,
  SettingsController.toggleMaintenanceMode,
);

module.exports = router;
