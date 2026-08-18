const CheckinReminder = require("../../models/checkinReminder");
const CheckinHistory = require("../../models/checkinHistory");
const { CustomError } = require("../../utils/error");
const { ensureParentUserAccessOrThrow } = require("../user/memberAccess");
const {
  getUtcDateTimeForTodayCheckin,
  getUtcStartOfDay,
  getUtcEndOfDayExclusive,
  isSameUtcDay,
} = require("../../utils/utcDateTime");

const DUE_ACTIONS = ["completed", "skipped", "remind_later"];
const ALLOWED_STATUSES = new Set(["completed", "skipped", "remind_later"]);

const deriveTemporalStatus = (checkinTime, now = new Date()) => {
  const reminderAt = getUtcDateTimeForTodayCheckin(checkinTime, now);

  if (!reminderAt) {
    return "due";
  }

  return now > reminderAt ? "overdue" : "due";
};

const getActionsByStatus = (status) => {
  if (status === "due" || status === "overdue" || status === "remind_later") {
    return DUE_ACTIONS;
  }

  return [];
};

const sortByCheckinTimeAsc = (left, right, now = new Date()) => {
  const leftDateTime = getUtcDateTimeForTodayCheckin(left?.time, now);
  const rightDateTime = getUtcDateTimeForTodayCheckin(right?.time, now);

  if (!leftDateTime && !rightDateTime) return 0;
  if (!leftDateTime) return 1;
  if (!rightDateTime) return -1;

  return leftDateTime.getTime() - rightDateTime.getTime();
};

const mapCheckinResponse = (checkinReminder, status) => ({
  id: checkinReminder._id,
  userId: checkinReminder.userId,
  time: checkinReminder.time,
  label: checkinReminder.label,
  isEnabled: checkinReminder.isEnabled,
  status,
  actions: getActionsByStatus(status),
});

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
      .select("checkinReminderId status remindAt")
      .lean(),
  ]);

  const historyByCheckinId = todayHistories.reduce((accumulator, historyItem) => {
    const checkinReminderId = String(historyItem.checkinReminderId);
    if (!accumulator.has(checkinReminderId)) {
      accumulator.set(checkinReminderId, {
        status: historyItem.status,
        remindAt: historyItem.remindAt,
      });
    }
    return accumulator;
  }, new Map());

  const sortedCheckins = [...checkinReminders].sort((left, right) =>
    sortByCheckinTimeAsc(left, right, now),
  );

  return sortedCheckins.map((checkinReminder) => {
    const history = historyByCheckinId.get(String(checkinReminder._id));

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

    return mapCheckinResponse(checkinReminder, finalStatus);
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
  }).select("_id userId");

  if (!checkinReminder) {
    throw new CustomError("Checkin reminder not found", [], 404);
  }

  const now = new Date();
  const dayStart = getUtcStartOfDay(now);

  const update = {
    status: normalizedStatus,
    completedAt: null,
    skippedAt: null,
    remindAt: null,
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

  return {
    checkinId: history.checkinReminderId,
    date: history.date,
    status: history.status,
    completedAt: history.completedAt,
    skippedAt: history.skippedAt,
    remindAt: history.remindAt,
    actions: [],
  };
};

module.exports = {
  getTodayCheckinResponse,
  updateCheckinStatusService,
  sortByCheckinTimeAsc,
  pickNearestUpcomingCheckin,
  pickNearestPassedCheckin,
  buildCheckinSummary,
};
