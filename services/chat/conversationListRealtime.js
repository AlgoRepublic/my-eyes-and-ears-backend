const User = require("../../models/user");
const { createRedisConnection } = require("../../config/redis");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { listConversationsService } = require("./conversations");
const {
  CONVERSATION_LIST_CHANNEL,
  buildUserRoom,
} = require("./conversationListPublisher");

const loadUserForConversationList = async (userId) =>
  User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });

const buildConversationListPayload = async (userId) => {
  const user = await loadUserForConversationList(userId);
  if (!user) {
    return null;
  }

  const conversations = await listConversationsService(user);
  return { conversations };
};

const emitConversationListToUser = async (conversationsIo, userId) => {
  if (!conversationsIo || !userId) {
    return;
  }

  const payload = await buildConversationListPayload(userId);
  if (!payload) {
    return;
  }

  conversationsIo.to(buildUserRoom(userId)).emit("conversations:updated", payload);
};

const subscribeConversationListUpdates = (conversationsIo) => {
  const subscriber = createRedisConnection();

  subscriber.subscribe(CONVERSATION_LIST_CHANNEL, (error) => {
    if (error) {
      console.error("Failed to subscribe to conversation list updates", error);
    }
  });

  subscriber.on("message", async (channel, userId) => {
    if (channel !== CONVERSATION_LIST_CHANNEL || !userId) {
      return;
    }

    try {
      await emitConversationListToUser(conversationsIo, userId);
    } catch (error) {
      console.error("Failed to emit conversation list update", error);
    }
  });

  return subscriber;
};

module.exports = {
  buildConversationListPayload,
  emitConversationListToUser,
  subscribeConversationListUpdates,
};
