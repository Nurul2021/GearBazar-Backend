/**
 * Notification Routes - User Notifications API
 */

const express = require("express");
const router = express.Router();
const NotificationService = require("../services/NotificationService");
const { verifyToken } = require("../middleware/auth");

router.get("/", verifyToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const result = await NotificationService.getUserNotifications(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", verifyToken, async (req, res, next) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/read", verifyToken, async (req, res, next) => {
  try {
    const notification = await NotificationService.markAsRead(
      req.params.id,
      req.user.id,
    );
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

router.put("/read-all", verifyToken, async (req, res, next) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    const result = await NotificationService.deleteNotification(
      req.params.id,
      req.user.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
