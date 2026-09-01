const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const notificationController = require("../controllers/api/v1/notifications");

const router = express.Router();

router.use(protect);
router.get("/", notificationController.listNotifications);
router.get("/unread-count", notificationController.getUnreadNotificationCount);
router.patch("/read-all", notificationController.markAllNotificationsRead);

module.exports = router;
