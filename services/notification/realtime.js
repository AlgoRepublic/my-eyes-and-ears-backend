const { createRedisConnection } = require("../../config/redis");
const { getUnreadNotificationCountByUserId } = require("./history");

const NOTIFICATION_UNREAD_COUNT_CHANNEL = "notification:unread-count:update";

const buildUserRoom = (userId) => `user:${String(userId)}`;

const publishNotificationUnreadCountUpdate = async (userId) => {
  const redis = createRedisConnection();
  try {
    await redis.publish(NOTIFICATION_UNREAD_COUNT_CHANNEL, String(userId));
  } finally {
    await redis.quit();
  }
};

const emitUnreadNotificationCountToUser = async (notificationIo, userId) => {
  if (!notificationIo || !userId) {
    return;
  }

  const { unreadCount } = await getUnreadNotificationCountByUserId(userId);

  notificationIo.to(buildUserRoom(userId)).emit("notification:unread-count", {
    unreadCount,
  });
};

const subscribeNotificationUnreadCountUpdates = (notificationIo) => {
  const subscriber = createRedisConnection();

  subscriber.subscribe(NOTIFICATION_UNREAD_COUNT_CHANNEL, (error) => {
    if (error) {
      console.error("Failed to subscribe to notification unread count updates", error);
    }
  });

  subscriber.on("message", async (channel, userId) => {
    if (channel !== NOTIFICATION_UNREAD_COUNT_CHANNEL || !userId) {
      return;
    }

    try {
      await emitUnreadNotificationCountToUser(notificationIo, userId);
    } catch (error) {
      console.error("Failed to emit notification unread count update", error);
    }
  });

  return subscriber;
};

module.exports = {
  NOTIFICATION_UNREAD_COUNT_CHANNEL,
  buildUserRoom,
  publishNotificationUnreadCountUpdate,
  emitUnreadNotificationCountToUser,
  subscribeNotificationUnreadCountUpdates,
};
