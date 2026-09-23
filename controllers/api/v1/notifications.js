const { asyncMiddleware } = require("../../../middlewares/async");
const {
  listNotificationHistoryService,
  getUnreadNotificationCountService,
  markAllNotificationsReadService,
} = require("../../../services/notification/history");

const listNotifications = asyncMiddleware(async (req, res, next) => {
  const data = await listNotificationHistoryService(req.user, {
    page: req.query.page,
    limit: req.query.limit,
    type: req.query.type,
    senderId: req.query.senderId,
    isRead: req.query.isRead,
  });

  next({
    success: true,
    message: "Notifications fetched successfully",
    statusCode: 200,
    data,
  });
});

const getUnreadNotificationCount = asyncMiddleware(async (req, res, next) => {
  const data = await getUnreadNotificationCountService(req.user);

  next({
    success: true,
    message: "Unread notification count fetched successfully",
    statusCode: 200,
    data,
  });
});

const markAllNotificationsRead = asyncMiddleware(async (req, res, next) => {
  const data = await markAllNotificationsReadService(req.user);

  next({
    success: true,
    message: "All notifications marked as read",
    statusCode: 200,
    data,
  });
});

module.exports = {
  listNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
};
