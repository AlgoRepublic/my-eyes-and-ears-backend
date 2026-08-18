const { Queue } = require("bullmq");
const notificationConfig = require("../config/notification");
const { createRedisConnection } = require("../config/redis");

let notificationQueue = null;

const getNotificationQueue = () => {
  if (!notificationQueue) {
    notificationQueue = new Queue(notificationConfig.queueName, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: notificationConfig.maxAttempts,
        backoff: {
          type: "exponential",
          delay: notificationConfig.backoffDelayMs,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  return notificationQueue;
};

const addNotificationJob = async ({ notificationId, scheduledAt }) => {
  const queue = getNotificationQueue();
  const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());

  return queue.add(
    "deliver",
    { notificationId },
    {
      jobId: `notification-${notificationId}`,
      delay,
    },
  );
};

const releaseNotificationToPending = async (notificationId, errorMessage) => {
  const Notification = require("../models/notification");

  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      status: "queued",
    },
    {
      $set: {
        status: "pending",
        lastError: errorMessage,
        updatedAt: new Date(),
      },
    },
  );
};

const enqueueNotificationJobSafely = async ({ notificationId, scheduledAt }) => {
  try {
    await addNotificationJob({ notificationId, scheduledAt });
    return true;
  } catch (error) {
    await releaseNotificationToPending(
      notificationId,
      error?.message || "queue_add_failed",
    );
    throw error;
  }
};

const getQueueStats = async () => {
  const queue = getNotificationQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
};

const closeNotificationQueue = async () => {
  if (!notificationQueue) {
    return;
  }

  const queue = notificationQueue;
  notificationQueue = null;
  await queue.close();
};

module.exports = {
  getNotificationQueue,
  addNotificationJob,
  enqueueNotificationJobSafely,
  releaseNotificationToPending,
  getQueueStats,
  closeNotificationQueue,
};
