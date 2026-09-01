const { registerSocketAuth } = require("../socket/auth");
const { buildUserRoom } = require("./realtime");
const { getUnreadNotificationCountByUserId } = require("./history");

const NOTIFICATION_SOCKET_NAMESPACE = "/notifications";

const registerNotificationSocketHandlers = (io) => {
  const notificationIo = io.of(NOTIFICATION_SOCKET_NAMESPACE);

  registerSocketAuth(notificationIo);

  notificationIo.on("connection", async (socket) => {
    socket.join(buildUserRoom(socket.user._id));

    try {
      const { unreadCount } = await getUnreadNotificationCountByUserId(
        socket.user._id,
      );
      socket.emit("notification:unread-count", { unreadCount });
    } catch (error) {
      console.error("Failed to send initial notification unread count", error);
    }
  });

  return notificationIo;
};

module.exports = {
  registerNotificationSocketHandlers,
  NOTIFICATION_SOCKET_NAMESPACE,
};
