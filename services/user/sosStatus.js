const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { ensureParentMemberOrThrow } = require("../user/memberAccess");
const {
  createActionNotificationsForParent,
} = require("../notification/notification.service");
const { getDashboardAudienceForParent } = require("../dashboard/audience");
const { notifyDashboardUpdates } = require("../dashboard/publisher");

const SOS_ACTIVE = "active";

const normalizeSosStatus = (status) => {
  if (status === undefined || status === null || status === "") {
    return null;
  }

  const normalized = String(status).trim().toLowerCase();
  if (normalized === "active") {
    return SOS_ACTIVE;
  }
  if (
    normalized === "resolved" ||
    normalized === "inactive" ||
    normalized === "cleared" ||
    normalized === "false" ||
    normalized === "null"
  ) {
    return null;
  }

  throw new CustomError(
    "sosStatus must be active or resolved/inactive",
    [],
    400,
  );
};

const resolveParentForSos = async (currentUser, memberUserId) => {
  if (currentUser.role === "parent") {
    if (memberUserId && String(memberUserId) !== String(currentUser._id)) {
      throw new CustomError(
        "Parents can only update their own SOS status",
        [],
        403,
      );
    }

    const parentUser = await User.findOne({
      _id: currentUser._id,
      role: "parent",
      ...ACTIVE_USER_FILTER,
    });

    if (!parentUser) {
      throw new CustomError("Parent user not found", [], 404);
    }

    return parentUser;
  }

  if (currentUser.role === "caregiver") {
    const normalizedMemberId = String(memberUserId || "").trim();
    if (!normalizedMemberId) {
      throw new CustomError("userId is required for caregiver SOS updates", [], 400);
    }

    return ensureParentMemberOrThrow(currentUser, normalizedMemberId);
  }

  throw new CustomError("Unauthorized", [], 403);
};

const updateSosStatusService = async (currentUser, payload = {}) => {
  const nextStatus = normalizeSosStatus(
    payload.sosStatus !== undefined ? payload.sosStatus : payload.status,
  );
  const parentUser = await resolveParentForSos(
    currentUser,
    payload.userId || payload.memberId,
  );

  const previousStatus = parentUser.sosStatus || null;
  if (previousStatus === nextStatus) {
    return {
      userId: parentUser._id,
      sosStatus: previousStatus,
    };
  }

  parentUser.sosStatus = nextStatus;
  await parentUser.save();

  if (nextStatus === SOS_ACTIVE) {
    await createActionNotificationsForParent({
      parentUserId: parentUser._id,
      senderId: currentUser._id || currentUser.id,
      type: "SOS",
      referenceId: parentUser._id,
      title: "SOS alert",
      body: `${parentUser.name} triggered an SOS alert.`,
      data: {
        memberId: String(parentUser._id),
        sosStatus: SOS_ACTIVE,
        createdAt: new Date().toISOString(),
      },
      bypassDoNotDisturb: true,
    });
  }

  const dashboardAudience = await getDashboardAudienceForParent(parentUser._id);
  await notifyDashboardUpdates(dashboardAudience, "recentData:sosStatus");

  return {
    userId: parentUser._id,
    sosStatus: parentUser.sosStatus || null,
  };
};

module.exports = {
  updateSosStatusService,
  SOS_ACTIVE,
};
