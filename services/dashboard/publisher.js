const { createRedisConnection } = require("../../config/redis");

const DASHBOARD_UPDATE_CHANNEL = "dashboard:data:update";

const publishDashboardUpdate = async (userId, eventName) => {
  const redis = createRedisConnection();
  try {
    await redis.publish(
      DASHBOARD_UPDATE_CHANNEL,
      JSON.stringify({
        userId: String(userId),
        eventName,
      }),
    );
  } finally {
    await redis.quit();
  }
};

const notifyDashboardUpdates = async (userIds, eventName) => {
  const uniqueUserIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .filter(Boolean)
        .map(String),
    ),
  ];

  await Promise.all(
    uniqueUserIds.map((userId) => publishDashboardUpdate(userId, eventName)),
  );
};

module.exports = {
  DASHBOARD_UPDATE_CHANNEL,
  publishDashboardUpdate,
  notifyDashboardUpdates,
};
