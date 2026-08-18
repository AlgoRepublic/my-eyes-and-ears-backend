const Notification = require("../../models/notification");
const notificationConfig = require("../../config/notification");
const { logNotificationEvent } = require("../../utils/notificationLogger");
const { getNotificationRecipients } = require("./recipients");
const { addNotificationJob, enqueueNotificationJobSafely } = require("../../queues/notification.queue");

const buildDedupeKey = ({
  type,
  referenceId,
  userId,
  scheduledAt,
}) => {
  return [
    type,
    String(referenceId),
    String(userId),
    new Date(scheduledAt).toISOString(),
  ].join(":");
};

const cancelFutureNotifications = async ({ type, referenceId }) => {
  const result = await Notification.updateMany(
    {
      type,
      referenceId,
      status: { $in: ["pending", "queued"] },
    },
    {
      $set: {
        status: "cancelled",
        updatedAt: new Date(),
      },
    },
  );

  logNotificationEvent("notifications_cancelled", {
    type,
    referenceId: String(referenceId),
    count: result.modifiedCount,
  });

  return result.modifiedCount;
};

const upsertScheduledNotifications = async ({
  type,
  referenceId,
  parentUserId,
  occurrences,
  buildContent,
  includeCaregivers = true,
}) => {
  await cancelFutureNotifications({ type, referenceId });

  if (!occurrences.length) {
    return [];
  }

  const recipients = await getNotificationRecipients({
    parentUserId,
    type,
    includeCaregivers,
  });

  if (!recipients.length) {
    return [];
  }

  const docs = [];

  for (const scheduledAt of occurrences) {
    for (const recipient of recipients) {
      const content = buildContent({ scheduledAt });
      docs.push({
        userId: recipient.userId,
        type,
        referenceId,
        title: content.title,
        body: content.body,
        data: content.data,
        scheduledAt,
        status: "pending",
        dedupeKey: buildDedupeKey({
          type,
          referenceId,
          userId: recipient.userId,
          scheduledAt,
        }),
      });
    }
  }

  if (!docs.length) {
    return [];
  }

  const inserted = [];
  for (const doc of docs) {
    try {
      const created = await Notification.findOneAndUpdate(
        { dedupeKey: doc.dedupeKey },
        {
          $setOnInsert: doc,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      if (created.status === "pending") {
        inserted.push(created);
      }
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  logNotificationEvent("notifications_created", {
    type,
    referenceId: String(referenceId),
    count: inserted.length,
  });

  for (const notification of inserted) {
    await queueNotificationIfDueSoon(notification);
  }

  return inserted;
};

const queueNotificationIfDueSoon = async (notification) => {
  const now = Date.now();
  const dueIn = new Date(notification.scheduledAt).getTime() - now;

  if (dueIn > notificationConfig.schedulerWindowMs) {
    return false;
  }

  const claimed = await Notification.findOneAndUpdate(
    {
      _id: notification._id,
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

  if (!claimed) {
    return false;
  }

  try {
    await enqueueNotificationJobSafely({
      notificationId: String(claimed._id),
      scheduledAt: claimed.scheduledAt,
    });
  } catch (error) {
    logNotificationEvent("notification_queue_error", {
      notificationId: String(claimed._id),
      error: error?.message,
    });
    return false;
  }

  logNotificationEvent("notification_queued", {
    notificationId: String(claimed._id),
    userId: String(claimed.userId),
    type: claimed.type,
  });

  return true;
};

const createImmediateNotification = async ({
  userId,
  type,
  referenceId,
  title,
  body,
  data = {},
}) => {
  const scheduledAt = new Date();
  const dedupeKey = `${type}:${referenceId}:${userId}:immediate:${Date.now()}`;

  const notification = await Notification.create({
    userId,
    type,
    referenceId,
    title,
    body,
    data,
    scheduledAt,
    status: "pending",
    dedupeKey,
  });

  await queueNotificationIfDueSoon(notification);
  return notification;
};

module.exports = {
  buildDedupeKey,
  cancelFutureNotifications,
  upsertScheduledNotifications,
  queueNotificationIfDueSoon,
  createImmediateNotification,
};
