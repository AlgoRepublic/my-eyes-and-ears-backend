const { createRedisConnection } = require("../../config/redis");

const CONVERSATION_LIST_CHANNEL = "chat:conversation-list:update";

const buildUserRoom = (userId) => `user:${String(userId)}`;

const publishConversationListUpdate = async (userId) => {
  const redis = createRedisConnection();
  try {
    await redis.publish(CONVERSATION_LIST_CHANNEL, String(userId));
  } finally {
    await redis.quit();
  }
};

const notifyConversationListUpdates = async (userIds) => {
  const uniqueUserIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .filter(Boolean)
        .map(String),
    ),
  ];

  await Promise.all(
    uniqueUserIds.map((userId) => publishConversationListUpdate(userId)),
  );
};

module.exports = {
  CONVERSATION_LIST_CHANNEL,
  buildUserRoom,
  publishConversationListUpdate,
  notifyConversationListUpdates,
};
