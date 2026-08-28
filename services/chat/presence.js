const activeConversationViews = new Set();

const buildPresenceKey = (userId, conversationId) =>
  `${String(userId)}:${String(conversationId)}`;

const markConversationActive = (userId, conversationId) => {
  activeConversationViews.add(buildPresenceKey(userId, conversationId));
};

const markConversationInactive = (userId, conversationId) => {
  activeConversationViews.delete(buildPresenceKey(userId, conversationId));
};

const isViewingConversation = (userId, conversationId) =>
  activeConversationViews.has(buildPresenceKey(userId, conversationId));

module.exports = {
  markConversationActive,
  markConversationInactive,
  isViewingConversation,
};
