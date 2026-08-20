require("../config/env");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const notificationConfig = require("../config/notification");
const { closeRedisConnection } = require("../config/redis");
const { closeNotificationQueue } = require("../queues/notification.queue");
const {
  runNotificationSchedulerCycle,
} = require("../services/notification/scheduler");
const { logNotificationEvent } = require("../utils/notificationLogger");

let intervalRef = null;
let shuttingDown = false;

const startScheduler = async () => {
  await connectDB();

  const tick = async () => {
    try {
      await runNotificationSchedulerCycle();
    } catch (error) {
      logNotificationEvent("scheduler_error", { error: error?.message });
    }
  };

  await tick();
  intervalRef = setInterval(tick, notificationConfig.schedulerIntervalMs);

  logNotificationEvent("scheduler_started", {
    intervalMs: notificationConfig.schedulerIntervalMs,
    windowMs: notificationConfig.schedulerWindowMs,
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logNotificationEvent("scheduler_shutdown_started", { signal });

  if (intervalRef) {
    clearInterval(intervalRef);
  }

  await closeNotificationQueue();
  await closeRedisConnection();
  await mongoose.connection.close();

  logNotificationEvent("scheduler_shutdown_complete", { signal });
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startScheduler().catch((error) => {
  console.error(error);
  process.exit(1);
});
