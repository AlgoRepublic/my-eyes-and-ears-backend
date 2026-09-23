const { createRedisConnection } = require("../../config/redis");

const DASHBOARD_UPDATE_CHANNEL = "dashboard:data:update";

const publishDashboardUpdate = async (userId, eventName, payload) => {
  const redis = createRedisConnection();
  try {
    const message = {
      userId: String(userId),
      eventName,
    };

    if (payload !== undefined) {
      message.payload = payload;
    }

    await redis.publish(DASHBOARD_UPDATE_CHANNEL, JSON.stringify(message));
  } finally {
    await redis.quit();
  }
};

const notifyDashboardUpdates = async (userIds, eventName, payload) => {
  const uniqueUserIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .filter(Boolean)
        .map(String),
    ),
  ];

  await Promise.all(
    uniqueUserIds.map((userId) =>
      publishDashboardUpdate(userId, eventName, payload),
    ),
  );
};

module.exports = {
  DASHBOARD_UPDATE_CHANNEL,
  publishDashboardUpdate,
  notifyDashboardUpdates,
};
