require("../config/env");
const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const notificationConfig = require("../config/notification");
const { createRedisConnection, closeRedisConnection } = require("../config/redis");
const { closeNotificationQueue } = require("../queues/notification.queue");
const { processNotificationJob } = require("../services/notification/processor");
const { logNotificationEvent } = require("../utils/notificationLogger");

let worker = null;
let shuttingDown = false;

const startWorker = async () => {
  await connectDB();

  worker = new Worker(
    notificationConfig.queueName,
    async (job) => {
      const { notificationId } = job.data;
      return processNotificationJob(notificationId);
    },
    {
      connection: createRedisConnection(),
      concurrency: notificationConfig.workerConcurrency,
    },
  );

  worker.on("failed", (job, error) => {
    logNotificationEvent("worker_job_failed", {
      jobId: job?.id,
      notificationId: job?.data?.notificationId,
      error: error?.message,
    });
  });

  worker.on("error", (error) => {
    logNotificationEvent("worker_error", { error: error?.message });
  });

  logNotificationEvent("worker_started", {
    concurrency: notificationConfig.workerConcurrency,
  });
};

const shutdown = async (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logNotificationEvent("worker_shutdown_started", { signal });

  if (worker) {
    await worker.close();
  }

  await closeNotificationQueue();
  await closeRedisConnection();
  await mongoose.connection.close();

  logNotificationEvent("worker_shutdown_complete", { signal });
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startWorker().catch((error) => {
  console.error(error);
  process.exit(1);
});
