const Notification = require("../../models/notification");
const notificationConfig = require("../../config/notification");
const { logNotificationEvent } = require("../../utils/notificationLogger");
const {
  sendNotificationToUser,
  isRetryableError,
} = require("./sender");

const claimNotificationForProcessing = async (notificationId) => {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      status: { $in: ["queued", "processing"] },
    },
    {
      $set: {
        status: "processing",
        updatedAt: new Date(),
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
};

const markNotificationSent = async (notificationId) => {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      status: "processing",
    },
    {
      $set: {
        status: "sent",
        sentAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
};

const markNotificationFailed = async (notificationId, errorMessage) => {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      status: "processing",
    },
    {
      $set: {
        status: "failed",
        failedAt: new Date(),
        lastError: errorMessage,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
};

const requeueNotification = async (notificationId, errorMessage) => {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      status: "processing",
    },
    {
      $set: {
        status: "pending",
        lastError: errorMessage,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
};

const processNotificationJob = async (notificationId) => {
  const existing = await Notification.findById(notificationId).lean();

  if (!existing) {
    logNotificationEvent("notification_missing", { notificationId });
    return { skipped: true, reason: "not_found" };
  }

  if (existing.status === "sent" || existing.status === "cancelled") {
    logNotificationEvent("notification_skip_terminal_status", {
      notificationId,
      status: existing.status,
    });
    return { skipped: true, reason: existing.status };
  }

  const notification = await claimNotificationForProcessing(notificationId);

  if (!notification) {
    return { skipped: true, reason: "not_claimed" };
  }

  logNotificationEvent("notification_processing", {
    notificationId,
    userId: String(notification.userId),
    type: notification.type,
    attempt: notification.attempts,
  });

  try {
    const delivery = await sendNotificationToUser({
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        type: notification.type,
        referenceId: String(notification.referenceId),
        notificationId: String(notification._id),
      },
      notificationId: String(notification._id),
    });

    if (!delivery.delivered) {
      if (notification.attempts >= notificationConfig.maxAttempts) {
        await markNotificationFailed(notificationId, delivery.reason || "undelivered");
        return { failed: true, reason: delivery.reason || "undelivered" };
      }

      await requeueNotification(notificationId, delivery.reason || "undelivered");
      throw new Error(delivery.reason || "undelivered");
    }

    await markNotificationSent(notificationId);
    logNotificationEvent("notification_sent", {
      notificationId,
      userId: String(notification.userId),
      type: notification.type,
      attempt: notification.attempts,
    });

    return { sent: true };
  } catch (error) {
    const message = error?.message || "notification_send_failed";
    const retryable = isRetryableError(error);

    if (!retryable || notification.attempts >= notificationConfig.maxAttempts) {
      await markNotificationFailed(notificationId, message);
      logNotificationEvent("notification_failed", {
        notificationId,
        userId: String(notification.userId),
        type: notification.type,
        attempt: notification.attempts,
        error: message,
      });
      return { failed: true, reason: message };
    }

    await requeueNotification(notificationId, message);
    logNotificationEvent("notification_retry", {
      notificationId,
      attempt: notification.attempts,
      error: message,
    });
    throw error;
  }
};

module.exports = {
  processNotificationJob,
  claimNotificationForProcessing,
  markNotificationSent,
  markNotificationFailed,
};
