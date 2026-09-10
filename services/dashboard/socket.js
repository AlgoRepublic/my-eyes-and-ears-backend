const { registerSocketAuth } = require("../socket/auth");
const {
  buildUserRoom,
  emitUnreadNotificationCountToUser,
} = require("../notification/realtime");
const { emitAllDashboardEventsToUser } = require("./realtime");

const DASHBOARD_SOCKET_NAMESPACE = "/dashboardData";

const registerDashboardSocketHandlers = (io) => {
  const dashboardIo = io.of(DASHBOARD_SOCKET_NAMESPACE);

  registerSocketAuth(dashboardIo);

  dashboardIo.on("connection", async (socket) => {
    socket.join(buildUserRoom(socket.user._id));

    try {
      await Promise.all([
        emitAllDashboardEventsToUser(dashboardIo, socket.user._id),
        emitUnreadNotificationCountToUser(dashboardIo, socket.user._id),
      ]);
    } catch (error) {
      console.error("Failed to send initial dashboard data", error);
    }
  });

  return dashboardIo;
};

module.exports = {
  registerDashboardSocketHandlers,
  DASHBOARD_SOCKET_NAMESPACE,
};
