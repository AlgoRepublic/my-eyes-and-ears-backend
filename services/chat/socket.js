const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { ensureConversationAccessOrThrow } = require("./chatAccess");
const {
  sendMessageService,
  markConversationReadService,
} = require("./messages");
const {
  markConversationActive,
  markConversationInactive,
} = require("./presence");

const extractSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!authToken || typeof authToken !== "string") {
    return null;
  }

  const trimmed = authToken.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim();
  }

  return trimmed;
};

const authenticateSocket = async (socket) => {
  const token = extractSocketToken(socket);
  if (!token) {
    throw new Error("Missing socket authentication token");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.id || decoded.userId;

  if (!userId) {
    throw new Error("Invalid socket token payload");
  }

  const user = await User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });

  if (!user) {
    throw new Error("Socket user not found");
  }

  return user;
};

const registerChatSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateSocket(socket);
      next();
    } catch (error) {
      next(new Error("Unauthorized socket connection"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("chat:join", async (payload = {}, callback) => {
      try {
        const conversationId = payload.conversationId;
        await ensureConversationAccessOrThrow(socket.user, conversationId);
        socket.join(`conversation:${conversationId}`);
        markConversationActive(socket.user._id, conversationId);
        socket.data.activeConversationId = conversationId;

        if (typeof callback === "function") {
          callback({ success: true });
        }
      } catch (error) {
        if (typeof callback === "function") {
          callback({ success: false, message: error.message });
        }
      }
    });

    socket.on("chat:leave", (payload = {}) => {
      const conversationId = payload.conversationId || socket.data.activeConversationId;
      if (!conversationId) {
        return;
      }

      socket.leave(`conversation:${conversationId}`);
      markConversationInactive(socket.user._id, conversationId);

      if (String(socket.data.activeConversationId) === String(conversationId)) {
        socket.data.activeConversationId = null;
      }
    });

    socket.on("message:send", async (payload = {}, callback) => {
      try {
        const conversationId = payload.conversationId;
        if (!conversationId) {
          throw new Error("conversationId is required");
        }

        const message = await sendMessageService(
          socket.user,
          conversationId,
          payload,
          { io },
        );

        socket.emit("message:sent", message);

        if (typeof callback === "function") {
          callback({ success: true, data: message });
        }
      } catch (error) {
        if (typeof callback === "function") {
          callback({ success: false, message: error.message });
        }
      }
    });

    socket.on("message:read", async (payload = {}, callback) => {
      try {
        const conversationId = payload.conversationId;
        if (!conversationId) {
          throw new Error("conversationId is required");
        }

        const result = await markConversationReadService(
          socket.user,
          conversationId,
          payload.messageId,
          { io },
        );

        if (typeof callback === "function") {
          callback({ success: true, data: result });
        }
      } catch (error) {
        if (typeof callback === "function") {
          callback({ success: false, message: error.message });
        }
      }
    });

    socket.on("typing:start", async (payload = {}) => {
      try {
        const conversationId = payload.conversationId;
        await ensureConversationAccessOrThrow(socket.user, conversationId);
        socket.to(`conversation:${conversationId}`).emit("typing:start", {
          conversationId,
          userId: socket.user._id,
        });
      } catch (_error) {
        // Ignore unauthorized typing events.
      }
    });

    socket.on("typing:stop", async (payload = {}) => {
      try {
        const conversationId = payload.conversationId;
        await ensureConversationAccessOrThrow(socket.user, conversationId);
        socket.to(`conversation:${conversationId}`).emit("typing:stop", {
          conversationId,
          userId: socket.user._id,
        });
      } catch (_error) {
        // Ignore unauthorized typing events.
      }
    });

    socket.on("disconnect", () => {
      const conversationId = socket.data.activeConversationId;
      if (conversationId) {
        markConversationInactive(socket.user._id, conversationId);
      }
    });
  });
};

module.exports = {
  registerChatSocketHandlers,
};
