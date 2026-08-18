const CheckinReminder = require("../../models/checkinReminder");
const CheckinHistory = require("../../models/checkinHistory");
const { CustomError } = require("../../utils/error");
const {
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
  ensureParentUserAccessOrThrow,
} = require("./memberAccess");
const {
  getTodayCheckinResponse,
  buildCheckinSummary,
} = require("../checkin/checkinHistory");
const { syncCheckinNotifications } = require("../notification/sync");

const mapCheckinReminder = (item) => ({
  id: item._id,
  userId: item.userId,
  time: item.time,
  label: item.label,
  isEnabled: item.isEnabled,
});

const createMemberCheckinService = async (
  currentUser,
  memberId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const time = String(payload.time || "").trim();

  if (!time) {
    throw new CustomError("time is required", [], 400);
  }

  const checkinReminder = await CheckinReminder.create({
    userId: parentUser._id,
    time,
    label: payload.label ? String(payload.label).trim() : null,
    isEnabled:
      payload.isEnabled !== undefined ? Boolean(payload.isEnabled) : true,
  });

  syncCheckinNotifications(checkinReminder._id);

  return {
    checkinReminder: mapCheckinReminder(checkinReminder),
  };
};

const updateMemberCheckinService = async (
  currentUser,
  memberId,
  checkinId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedCheckinId = ensureObjectIdOrThrow(checkinId, "checkinId");

  const checkinReminder = await CheckinReminder.findOne({
    _id: normalizedCheckinId,
    userId: parentUser._id,
  });

  if (!checkinReminder) {
    throw new CustomError("Checkin reminder not found", [], 404);
  }

  if (payload.time !== undefined) {
    const time = String(payload.time || "").trim();
    if (!time) {
      throw new CustomError("time cannot be empty", [], 400);
    }
    checkinReminder.time = time;
  }

  if (payload.label !== undefined) {
    checkinReminder.label = payload.label ? String(payload.label).trim() : null;
  }

  if (payload.isEnabled !== undefined) {
    checkinReminder.isEnabled = Boolean(payload.isEnabled);
  }

  await checkinReminder.save();

  syncCheckinNotifications(checkinReminder._id);

  return {
    checkinReminder: mapCheckinReminder(checkinReminder),
  };
};

const deleteMemberCheckinService = async (currentUser, memberId, checkinId) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedCheckinId = ensureObjectIdOrThrow(checkinId, "checkinId");

  const deleted = await CheckinReminder.findOneAndDelete({
    _id: normalizedCheckinId,
    userId: parentUser._id,
  });

  if (!deleted) {
    throw new CustomError("Checkin reminder not found", [], 404);
  }

  await CheckinHistory.deleteMany({ checkinReminderId: deleted._id });

  const { cancelFutureNotifications } = require("../notification/notification.service");
  cancelFutureNotifications({
    type: "checkinReminder",
    referenceId: deleted._id,
  });

  return {
    deletedCheckinId: String(deleted._id),
  };
};

const getMemberCheckinsService = async (currentUser, memberId) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const checkins = await getTodayCheckinResponse(parentUser._id);
  const now = new Date();

  return {
    checkins,
    ...buildCheckinSummary(checkins, now),
  };
};

const getTodayCheckinsService = async (currentUser, userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const parentUser = await ensureParentUserAccessOrThrow(currentUser, userId);
  const checkins = await getTodayCheckinResponse(parentUser._id);
  const now = new Date();

  return {
    checkins,
    ...buildCheckinSummary(checkins, now),
  };
};

module.exports = {
  getMemberCheckinsService,
  getTodayCheckinsService,
  createMemberCheckinService,
  updateMemberCheckinService,
  deleteMemberCheckinService,
};
