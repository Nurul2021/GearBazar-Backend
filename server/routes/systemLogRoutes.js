/**
 * System Log Routes - Admin Activity Audit Trail
 */

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const { isAdmin } = require("../middleware/roleMiddleware");

const SystemLogController = require("../controllers/SystemLogController");

router.get("/", requireAuth, isAdmin(), SystemLogController.getLogs);

router.get("/stats", requireAuth, isAdmin(), SystemLogController.getLogStats);

router.get(
  "/admin/:adminId",
  requireAuth,
  isAdmin(),
  SystemLogController.getLogsByAdmin,
);

router.get("/:logId", requireAuth, isAdmin(), SystemLogController.getLogById);

module.exports = router;
