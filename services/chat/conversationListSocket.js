const { registerSocketAuth } = require("../socket/auth");
const { buildUserRoom } = require("./conversationListPublisher");
const { buildConversationListPayload } = require("./conversationListRealtime");

const CONVERSATION_LIST_SOCKET_NAMESPACE = "/conversations";

const registerConversationListSocketHandlers = (io) => {
  const conversationsIo = io.of(CONVERSATION_LIST_SOCKET_NAMESPACE);

  registerSocketAuth(conversationsIo);

  conversationsIo.on("connection", async (socket) => {
    socket.join(buildUserRoom(socket.user._id));

    try {
      const payload = await buildConversationListPayload(socket.user._id);
      if (payload) {
        socket.emit("conversations:updated", payload);
      }
    } catch (error) {
      console.error("Failed to send initial conversation list", error);
    }
  });

  return conversationsIo;
};

module.exports = {
  registerConversationListSocketHandlers,
  CONVERSATION_LIST_SOCKET_NAMESPACE,
};
