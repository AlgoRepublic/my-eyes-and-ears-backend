const { createRedisConnection } = require("../../config/redis");
const { buildUserRoom } = require("../notification/realtime");
const {
  DASHBOARD_EVENT_BUILDERS,
  buildDashboardEventPayload,
} = require("./data");
const { DASHBOARD_UPDATE_CHANNEL } = require("./publisher");

const emitDashboardEventToUser = async (dashboardIo, userId, eventName) => {
  if (!dashboardIo || !userId || !DASHBOARD_EVENT_BUILDERS[eventName]) {
    return;
  }

  const payload = await buildDashboardEventPayload(userId, eventName);
  if (!payload) {
    return;
  }

  dashboardIo.to(buildUserRoom(userId)).emit(eventName, payload);
};

const emitAllDashboardEventsToUser = async (dashboardIo, userId) => {
  await Promise.all(
    Object.keys(DASHBOARD_EVENT_BUILDERS).map((eventName) =>
      emitDashboardEventToUser(dashboardIo, userId, eventName),
    ),
  );
};

const subscribeDashboardUpdates = (dashboardIo) => {
  const subscriber = createRedisConnection();

  subscriber.subscribe(DASHBOARD_UPDATE_CHANNEL, (error) => {
    if (error) {
      console.error("Failed to subscribe to dashboard updates", error);
    }
  });

  subscriber.on("message", async (channel, message) => {
    if (channel !== DASHBOARD_UPDATE_CHANNEL || !message) {
      return;
    }

    try {
      const { userId, eventName } = JSON.parse(message);
      if (!userId || !eventName) {
        return;
      }

      await emitDashboardEventToUser(dashboardIo, userId, eventName);
    } catch (error) {
      console.error("Failed to emit dashboard update", error);
    }
  });

  return subscriber;
};

module.exports = {
  emitDashboardEventToUser,
  emitAllDashboardEventsToUser,
  subscribeDashboardUpdates,
};
