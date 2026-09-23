const { CustomError } = require("../../utils/error");
const { LOCATION_STATUS } = require("../../utils/location");
const { ensureParentMemberOrThrow } = require("./memberAccess");
const {
  createImmediateNotification,
} = require("../notification/notification.service");
const { getCaregiverAudienceForParent } = require("../dashboard/audience");
const { notifyDashboardUpdates } = require("../dashboard/publisher");

const requestMemberLocationService = async (currentUser, memberId) => {
  if (currentUser?.role !== "caregiver") {
    throw new CustomError("Only caregivers can request member location", [], 403);
  }

  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const previousStatus = parentUser.locationStatus || LOCATION_STATUS.IDLE;

  parentUser.locationStatus = LOCATION_STATUS.REQUESTED;
  await parentUser.save();

  await notifyDashboardUpdates([parentUser._id], "location_status", {
    location_status: LOCATION_STATUS.REQUESTED,
  });

  const caregiverAudience = await getCaregiverAudienceForParent(parentUser._id);
  if (caregiverAudience.length) {
    await notifyDashboardUpdates(caregiverAudience, "location_status");
  }

  const caregiverName = currentUser.name || "Your caregiver";
  await createImmediateNotification({
    userId: parentUser._id,
    senderId: currentUser._id || currentUser.id,
    subjectUserId: parentUser._id,
    type: "checkinReminder",
    referenceId: parentUser._id,
    title: "Location request",
    body: `${caregiverName} asked you to share your location.`,
    data: {
      type: "location_request",
      parentUserId: String(parentUser._id),
      location_status: LOCATION_STATUS.REQUESTED,
    },
  });

  return {
    userId: parentUser._id,
    location_status: parentUser.locationStatus,
    previous_location_status: previousStatus,
  };
};

module.exports = {
  requestMemberLocationService,
};
