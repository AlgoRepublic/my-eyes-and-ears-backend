const Notification = require("../../models/notification");
const notificationConfig = require("../../config/notification");
const { logNotificationEvent } = require("../../utils/notificationLogger");
const { enqueueNotificationJobSafely } = require("../../queues/notification.queue");

const claimPendingNotificationsBatch = async (now = new Date()) => {
  const windowEnd = new Date(now.getTime() + notificationConfig.schedulerWindowMs);
  const claimed = [];

  const candidates = await Notification.find({
    status: "pending",
    scheduledAt: { $lte: windowEnd },
  })
    .sort({ scheduledAt: 1 })
    .limit(notificationConfig.schedulerBatchSize)
    .select("_id scheduledAt")
    .lean();

  for (const candidate of candidates) {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "pending",
      },
      {
        $set: {
          status: "queued",
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!notification) {
      continue;
    }

    claimed.push(notification);
  }

  return claimed;
};

const reclaimStuckQueuedBatch = async (now = new Date()) => {
  const windowEnd = new Date(now.getTime() + notificationConfig.schedulerWindowMs);

  return Notification.find({
    status: "queued",
    scheduledAt: { $lte: windowEnd },
  })
    .sort({ scheduledAt: 1 })
    .limit(notificationConfig.schedulerBatchSize)
    .select("_id scheduledAt")
    .lean();
};

const runNotificationSchedulerCycle = async () => {
  const now = new Date();
  const claimed = await claimPendingNotificationsBatch(now);
  const stuckQueued = await reclaimStuckQueuedBatch(now);
  let queuedCount = 0;

  for (const notification of [...claimed, ...stuckQueued]) {
    try {
      await enqueueNotificationJobSafely({
        notificationId: String(notification._id),
        scheduledAt: notification.scheduledAt,
      });
      queuedCount += 1;
    } catch (error) {
      logNotificationEvent("scheduler_queue_error", {
        notificationId: String(notification._id),
        error: error?.message,
      });
    }
  }

  if (queuedCount > 0) {
    logNotificationEvent("scheduler_cycle_complete", {
      queuedCount,
    });
  }

  return { queuedCount };
};

module.exports = {
  claimPendingNotificationsBatch,
  runNotificationSchedulerCycle,
};
