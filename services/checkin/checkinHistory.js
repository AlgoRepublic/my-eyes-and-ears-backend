const CheckinReminder = require("../../models/checkinReminder");
const CheckinHistory = require("../../models/checkinHistory");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { ensureParentUserAccessOrThrow } = require("../user/memberAccess");
const {
  createActionNotificationsForParent,
} = require("../notification/notification.service");
const {
  getUtcDateTimeForTodayCheckin,
  getUtcStartOfDay,
  getUtcEndOfDayExclusive,
  isSameUtcDay,
} = require("../../utils/utcDateTime");

const ALLOWED_STATUSES = new Set(["completed", "skipped", "remind_later"]);

const mapChangedByUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user._id || user.id,
    name: user.name,
    role: user.role,
    email: user.email ?? null,
  };
};

const loadChangedByUsersMap = async (histories = []) => {
  const userIds = [
    ...new Set(
      histories
        .map((historyItem) =>
          historyItem?.changedBy ? String(historyItem.changedBy) : null,
        )
        .filter(Boolean),
    ),
  ];

  if (userIds.length === 0) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: userIds } })
    .select("name role email")
    .lean();

  return users.reduce((accumulator, user) => {
    accumulator.set(String(user._id), user);
    return accumulator;
  }, new Map());
};

const resolveChangedBy = (history, changedByUsersMap = new Map()) => {
  if (!history?.changedBy) {
    return null;
  }

  return mapChangedByUser(changedByUsersMap.get(String(history.changedBy)));
};

const deriveTemporalStatus = (checkinTime, now = new Date()) => {
  const reminderAt = getUtcDateTimeForTodayCheckin(checkinTime, now);

  if (!reminderAt) {
    return "due";
  }

  return now > reminderAt ? "overdue" : "due";
};

const sortByCheckinTimeAsc = (left, right, now = new Date()) => {
  const leftDateTime = getUtcDateTimeForTodayCheckin(left?.time, now);
  const rightDateTime = getUtcDateTimeForTodayCheckin(right?.time, now);

  if (!leftDateTime && !rightDateTime) return 0;
  if (!leftDateTime) return 1;
  if (!rightDateTime) return -1;

  return leftDateTime.getTime() - rightDateTime.getTime();
};

const mapCheckinResponse = ({
  checkinReminder,
  status,
  remindAt = null,
  completedAt = null,
  missedAt = null,
  changedBy = null,
}) => ({
  id: checkinReminder._id,
  userId: checkinReminder.userId,
  time: checkinReminder.time,
  label: checkinReminder.label,
  isEnabled: checkinReminder.isEnabled,
  status,
  remindAt,
  completedAt,
  missedAt,
  changedBy,
});

const getScheduledCheckinDateTime = (
  checkinReminder,
  referenceDate = new Date(),
) => {
  return getUtcDateTimeForTodayCheckin(checkinReminder?.time, referenceDate);
};

const resolveCheckinTimestamps = ({ status, history, scheduledAt }) => {
  if (status === "completed") {
    return {
      completedAt: history?.completedAt ?? null,
      missedAt: null,
    };
  }

  if (status === "skipped" || status === "overdue" || status === "missed") {
    return {
      completedAt: null,
      missedAt: history?.skippedAt ?? scheduledAt ?? null,
    };
  }

  return {
    completedAt: null,
    missedAt: null,
  };
};

const resolveTodayCheckinStatus = (
  checkinReminder,
  history,
  now = new Date(),
) => {
  let finalStatus = deriveTemporalStatus(checkinReminder.time, now);

  if (history?.status === "completed" || history?.status === "skipped") {
    finalStatus = history.status;
  } else if (history?.status === "remind_later") {
    const remindAt = history.remindAt ? new Date(history.remindAt) : null;
    if (remindAt && !Number.isNaN(remindAt.getTime()) && now > remindAt) {
      finalStatus = "overdue";
    } else {
      finalStatus = "remind_later";
    }
  }

  return finalStatus;
};

const buildCheckinsForDate = ({
  checkinReminders,
  historiesForDate = [],
  referenceDate,
  now = new Date(),
  changedByUsersMap = new Map(),
}) => {
  const dayStart = getUtcStartOfDay(referenceDate);
  const todayStart = getUtcStartOfDay(now);
  const isPastDay = dayStart.getTime() < todayStart.getTime();

  const historyByCheckinId = historiesForDate.reduce(
    (accumulator, historyItem) => {
      const checkinReminderId = String(historyItem.checkinReminderId);
      if (!accumulator.has(checkinReminderId)) {
        accumulator.set(checkinReminderId, historyItem);
      }
      return accumulator;
    },
    new Map(),
  );

  const sortedCheckins = [...checkinReminders].sort((left, right) =>
    sortByCheckinTimeAsc(left, right, referenceDate),
  );

  return sortedCheckins.map((checkinReminder) => {
    const history = historyByCheckinId.get(String(checkinReminder._id));
    const scheduledAt = getScheduledCheckinDateTime(
      checkinReminder,
      referenceDate,
    );

    if (isPastDay) {
      const status = history?.status === "completed" ? "completed" : "missed";
      const timestamps = resolveCheckinTimestamps({
        status,
        history,
        scheduledAt,
      });

      return mapCheckinResponse({
        checkinReminder,
        status,
        remindAt: null,
        completedAt: timestamps.completedAt,
        missedAt: timestamps.missedAt,
        changedBy: resolveChangedBy(history, changedByUsersMap),
      });
    }

    const finalStatus = resolveTodayCheckinStatus(
      checkinReminder,
      history,
      now,
    );
    const timestamps = resolveCheckinTimestamps({
      status: finalStatus,
      history,
      scheduledAt,
    });

    return mapCheckinResponse({
      checkinReminder,
      status: finalStatus,
      remindAt: history?.remindAt ?? null,
      completedAt: timestamps.completedAt,
      missedAt: timestamps.missedAt,
      changedBy: resolveChangedBy(history, changedByUsersMap),
    });
  });
};

const deriveStreakStatus = (checkins = []) => {
  if (checkins.length === 0) {
    return "completed";
  }

  return checkins.every((checkin) => checkin.status === "completed")
    ? "completed"
    : "missed";
};

const buildPastCheckinHistory = ({
  checkinReminders,
  histories = [],
  now = new Date(),
  days = 7,
  changedByUsersMap = new Map(),
}) => {
  const todayStart = getUtcStartOfDay(now);
  const historiesByDate = histories.reduce((accumulator, historyItem) => {
    const dateKey = getUtcStartOfDay(historyItem.date).getTime();
    if (!accumulator.has(dateKey)) {
      accumulator.set(dateKey, []);
    }
    accumulator.get(dateKey).push(historyItem);
    return accumulator;
  }, new Map());

  const checkInHistory = [];

  for (let dayOffset = 1; dayOffset <= days; dayOffset += 1) {
    const referenceDate = new Date(
      Date.UTC(
        todayStart.getUTCFullYear(),
        todayStart.getUTCMonth(),
        todayStart.getUTCDate() - dayOffset,
      ),
    );
    const dateKey = referenceDate.getTime();
    const checkins = buildCheckinsForDate({
      checkinReminders,
      historiesForDate: historiesByDate.get(dateKey) || [],
      referenceDate,
      now,
      changedByUsersMap,
    });

    checkInHistory.push({
      date: referenceDate,
      streakStatus: deriveStreakStatus(checkins),
      checkIns: checkins,
    });
  }

  return checkInHistory;
};

const getCheckinsWithHistoryResponse = async (userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const now = new Date();
  const todayStart = getUtcStartOfDay(now);
  const todayEndExclusive = getUtcEndOfDayExclusive(now);
  const historyStart = new Date(
    Date.UTC(
      todayStart.getUTCFullYear(),
      todayStart.getUTCMonth(),
      todayStart.getUTCDate() - 7,
    ),
  );

  const [checkinReminders, histories] = await Promise.all([
    CheckinReminder.find({ userId, isEnabled: true }).sort({ createdAt: 1 }),
    CheckinHistory.find({
      userId,
      date: { $gte: historyStart, $lt: todayEndExclusive },
    })
      .select(
        "checkinReminderId status remindAt completedAt skippedAt date changedBy",
      )
      .lean(),
  ]);

  const changedByUsersMap = await loadChangedByUsersMap(histories);

  const todayHistories = histories.filter(
    (historyItem) =>
      historyItem.date >= todayStart && historyItem.date < todayEndExclusive,
  );
  const pastHistories = histories.filter(
    (historyItem) =>
      historyItem.date >= historyStart && historyItem.date < todayStart,
  );

  const checkins = buildCheckinsForDate({
    checkinReminders,
    historiesForDate: todayHistories,
    referenceDate: now,
    now,
    changedByUsersMap,
  });
  const checkInHistory = buildPastCheckinHistory({
    checkinReminders,
    histories: pastHistories,
    now,
    days: 7,
    changedByUsersMap,
  });

  return {
    checkins,
    ...buildCheckinSummary(checkins, now),
    checkInHistory,
  };
};

const getTodayCheckinResponse = async (userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const dayStart = getUtcStartOfDay();
  const dayEndExclusive = getUtcEndOfDayExclusive();
  const now = new Date();

  const [checkinReminders, todayHistories] = await Promise.all([
    CheckinReminder.find({ userId, isEnabled: true }).sort({ createdAt: 1 }),
    CheckinHistory.find({
      userId,
      date: { $gte: dayStart, $lt: dayEndExclusive },
    })
      .select("checkinReminderId status remindAt completedAt skippedAt changedBy")
      .lean(),
  ]);

  const changedByUsersMap = await loadChangedByUsersMap(todayHistories);

  return buildCheckinsForDate({
    checkinReminders,
    historiesForDate: todayHistories,
    referenceDate: now,
    now,
    changedByUsersMap,
  });
};

const pickNearestUpcomingCheckin = (checkins = [], now = new Date()) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const checkin of checkins) {
    if (checkin.status === "completed" || checkin.status === "skipped") {
      continue;
    }

    const dateTime = getUtcDateTimeForTodayCheckin(checkin?.time, now);
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = checkin;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const pickNearestPassedCheckin = (checkins = [], now = new Date()) => {
  let nearest = null;
  let nearestDateTime = null;
  const dayStart = getUtcStartOfDay(now);

  for (const checkin of checkins) {
    const dateTime = getUtcDateTimeForTodayCheckin(checkin?.time, now);
    if (
      !dateTime ||
      !isSameUtcDay(dateTime, now) ||
      dateTime < dayStart ||
      dateTime > now
    ) {
      continue;
    }

    if (!nearestDateTime || dateTime > nearestDateTime) {
      nearest = checkin;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const buildCheckinSummary = (checkins = [], now = new Date()) => ({
  upcomingCheckin: pickNearestUpcomingCheckin(checkins, now) || null,
  nearestPassedCheckin: pickNearestPassedCheckin(checkins, now) || null,
});

const updateCheckinStatusService = async ({
  currentUser,
  userId,
  checkinId,
  status,
  remindAt,
}) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  if (!checkinId || !status) {
    throw new CustomError("checkinId and status are required", [], 400);
  }

  const parentUser = await ensureParentUserAccessOrThrow(currentUser, userId);

  const normalizedStatus = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    throw new CustomError("Invalid status", [], 400);
  }

  let parsedRemindAt = null;
  if (normalizedStatus === "remind_later") {
    if (!remindAt) {
      throw new CustomError("remindAt is required for remind_later", [], 400);
    }

    parsedRemindAt = new Date(remindAt);
    if (Number.isNaN(parsedRemindAt.getTime())) {
      throw new CustomError("Invalid remindAt datetime", [], 400);
    }
  }

  const checkinReminder = await CheckinReminder.findOne({
    _id: checkinId,
    userId: parentUser._id,
    isEnabled: true,
  }).select("_id userId label");

  if (!checkinReminder) {
    throw new CustomError("Checkin reminder not found", [], 404);
  }

  const now = new Date();
  const dayStart = getUtcStartOfDay(now);
  const changedById = currentUser?._id || currentUser?.id;

  if (!changedById) {
    throw new CustomError("Authenticated user is required", [], 401);
  }

  const update = {
    status: normalizedStatus,
    completedAt: null,
    skippedAt: null,
    remindAt: null,
    changedBy: changedById,
  };

  if (normalizedStatus === "completed") {
    update.completedAt = now;
  }

  if (normalizedStatus === "skipped") {
    update.skippedAt = now;
  }

  if (normalizedStatus === "remind_later") {
    update.remindAt = parsedRemindAt;
  }

  const history = await CheckinHistory.findOneAndUpdate(
    {
      userId: checkinReminder.userId,
      checkinReminderId: checkinReminder._id,
      date: dayStart,
    },
    {
      $set: update,
      $setOnInsert: {
        checkinReminderId: checkinReminder._id,
        userId: checkinReminder.userId,
        date: dayStart,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  const changedByUser = await User.findById(changedById)
    .select("name role email")
    .lean();

  await createActionNotificationsForParent({
    parentUserId: parentUser._id,
    senderId: changedById,
    type: "checkinReminder",
    referenceId: checkinReminder._id,
    title: "Check-in status updated",
    body: `${parentUser.name} marked ${checkinReminder.label || "a check-in"} as ${history.status}.`,
    data: {
      type: "checkin_status",
      checkinId: String(checkinReminder._id),
      parentUserId: String(parentUser._id),
      status: history.status,
    },
  });

  return {
    checkinId: history.checkinReminderId,
    date: history.date,
    status: history.status,
    completedAt: history.completedAt,
    skippedAt: history.skippedAt,
    remindAt: history.remindAt,
    changedBy: mapChangedByUser(changedByUser),
  };
};

module.exports = {
  getTodayCheckinResponse,
  getCheckinsWithHistoryResponse,
  updateCheckinStatusService,
  sortByCheckinTimeAsc,
  pickNearestUpcomingCheckin,
  pickNearestPassedCheckin,
  buildCheckinSummary,
};
