const mongoose = require("mongoose");
const Notification = require("../../models/notification");
const { CustomError } = require("../../utils/error");

const API_TYPE_TO_STORED_TYPE = {
  SOS: "SOS",
  CHECKIN: "checkinReminder",
  MEDICATION: "medication",
  MESSAGE: "MESSAGE",
  APPOINTMENT: "appointment",
};

const STORED_TYPE_TO_API_TYPE = Object.entries(API_TYPE_TO_STORED_TYPE).reduce(
  (result, [apiType, storedType]) => {
    result[storedType] = apiType;
    return result;
  },
  {},
);
STORED_TYPE_TO_API_TYPE.chat = "MESSAGE";
STORED_TYPE_TO_API_TYPE.sos = "SOS";

const parsePositiveInteger = (value, name, defaultValue, maximum) => {
  if (value === undefined) {
    return defaultValue;
  }

  if (!/^\d+$/.test(String(value))) {
    throw new CustomError(`${name} must be a positive integer`, [], 400);
  }

  const parsed = Number.parseInt(String(value), 10);
  if (parsed < 1 || parsed > maximum) {
    throw new CustomError(`${name} must be between 1 and ${maximum}`, [], 400);
  }

  return parsed;
};

const normalizeObjectId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && value._id) {
    return String(value._id);
  }

  return String(value);
};

const mapNotificationUser = (user) => {
  if (!user?._id) {
    return null;
  }

  return {
    _id: String(user._id),
    name: user.name,
    email: user.email ?? null,
    imageUrl: user.image ?? null,
    relation: user.relation ?? null,
    role: user.role ?? null,
  };
};

const resolveCaregiverUser = (notification) => {
  if (notification.subjectUserId?._id) {
    return mapNotificationUser(notification.subjectUserId);
  }

  if (notification.type === "MESSAGE" || notification.type === "chat") {
    return mapNotificationUser(notification.senderId);
  }

  if (notification.senderId?._id) {
    return mapNotificationUser(notification.senderId);
  }

  return null;
};

const mapNotificationForUser = (notification, currentUser) => {
  const mapped = {
    _id: String(notification._id),
    userId: normalizeObjectId(notification.userId),
    senderId: normalizeObjectId(notification.senderId),
    type: STORED_TYPE_TO_API_TYPE[notification.type] || notification.type,
    title: notification.title,
    body: notification.body,
    referenceId: normalizeObjectId(notification.referenceId),
    isRead: notification.isRead,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };

  if (currentUser.role === "caregiver") {
    const user = resolveCaregiverUser(notification);
    if (user) {
      mapped.user = user;
    }
  }

  return mapped;
};

const listNotificationHistoryService = async (currentUser, filters = {}) => {
  const page = parsePositiveInteger(
    filters.page,
    "page",
    1,
    Number.MAX_SAFE_INTEGER,
  );
  const limit = parsePositiveInteger(filters.limit, "limit", 20, 100);
  // History only shows completed (delivered) notifications, not pending/queued/delayed ones.
  const query = { userId: currentUser._id, status: "sent" };

  if (filters.type !== undefined) {
    const storedType = API_TYPE_TO_STORED_TYPE[filters.type];
    if (!storedType) {
      throw new CustomError("Invalid notification type", [], 400);
    }
    if (storedType === "MESSAGE") {
      query.type = { $in: ["MESSAGE", "chat"] };
    } else if (storedType === "SOS") {
      query.type = { $in: ["SOS", "sos"] };
    } else {
      query.type = storedType;
    }
  }

  if (filters.senderId !== undefined) {
    if (!mongoose.isValidObjectId(filters.senderId)) {
      throw new CustomError("Invalid senderId", [], 400);
    }
    query.senderId = filters.senderId;
  }

  if (filters.isRead !== undefined) {
    if (filters.isRead !== "true" && filters.isRead !== "false") {
      throw new CustomError("isRead must be true or false", [], 400);
    }
    query.isRead = filters.isRead === "true";
  }

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .populate("subjectUserId", "name email image role relation")
      .populate("senderId", "name email image role relation")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(query),
  ]);

  return {
    notifications: notifications.map((notification) =>
      mapNotificationForUser(notification, currentUser),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const UNREAD_COUNT_STATUSES = ["pending", "queued", "processing", "sent"];

const buildUnreadCountQuery = (userId) => ({
  userId,
  status: { $in: UNREAD_COUNT_STATUSES },
  isRead: false,
});

const getUnreadNotificationCountByUserId = async (userId) => {
  const unreadCount = await Notification.countDocuments(buildUnreadCountQuery(userId));

  return { unreadCount };
};

const getUnreadNotificationCountService = async (currentUser) =>
  getUnreadNotificationCountByUserId(currentUser._id);

const markAllNotificationsReadService = async (currentUser) => {
  const readAt = new Date();
  const result = await Notification.updateMany(
    buildUnreadCountQuery(currentUser._id),
    {
      $set: {
        isRead: true,
        readAt,
      },
    },
  );

  return {
    modifiedCount: result.modifiedCount,
    readAt,
  };
};

module.exports = {
  UNREAD_COUNT_STATUSES,
  buildUnreadCountQuery,
  listNotificationHistoryService,
  getUnreadNotificationCountByUserId,
  getUnreadNotificationCountService,
  markAllNotificationsReadService,
};
