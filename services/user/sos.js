const User = require("../../models/user");
const Sos = require("../../models/sos");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { ensureParentMemberOrThrow } = require("./memberAccess");
const {
  extractLocationPayload,
  normalizeLocationInput,
  hasValidCoordinates,
} = require("../../utils/location");
const {
  createActionNotificationsForParent,
} = require("../notification/notification.service");
const {
  getCaregiverAudienceForParent,
} = require("../dashboard/audience");
const { notifyDashboardUpdates } = require("../dashboard/publisher");
const {
  buildMemberSosStatusSocketPayload,
  buildSosFcmData,
  toIsoString,
} = require("./sosFormat");

const SOS_ACTIVE = "active";
const SOS_CANCELLED = "cancelled";
const SOS_RESOLVED = "resolved";

const cloneLocation = (location) => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const plain =
    typeof location.toObject === "function" ? location.toObject() : location;

  return {
    latitude: plain.latitude ?? null,
    longitude: plain.longitude ?? null,
    accuracy: plain.accuracy ?? null,
    address: plain.address ?? null,
    city: plain.city ?? null,
    state: plain.state ?? null,
    country: plain.country ?? null,
    postalCode: plain.postalCode ?? null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt) : new Date(),
  };
};

const resolveSosLocation = (payload, parentUser) => {
  const locationPayload = extractLocationPayload(payload);
  const submitted = normalizeLocationInput(locationPayload, {
    requireCoordinates: false,
  });

  if (submitted && hasValidCoordinates(submitted)) {
    return submitted;
  }

  if (hasValidCoordinates(parentUser.location)) {
    return cloneLocation(parentUser.location);
  }

  return submitted || null;
};

const getParentSelfOrThrow = async (currentUser, userIdFromPayload) => {
  if (currentUser.role !== "parent") {
    throw new CustomError(
      "Only loved ones can manage their own SOS alerts",
      [],
      403,
    );
  }

  const currentUserId = String(currentUser._id || currentUser.id);
  const requestedUserId = String(userIdFromPayload || "").trim();

  if (!requestedUserId) {
    throw new CustomError("userId is required", [], 400);
  }

  if (requestedUserId !== currentUserId) {
    throw new CustomError("You can only manage your own SOS alerts", [], 403);
  }

  const parentUser = await User.findOne({
    _id: currentUserId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  });

  if (!parentUser) {
    throw new CustomError("Parent user not found", [], 404);
  }

  return parentUser;
};

const getCaregiverMemberOrThrow = async (currentUser, memberId) => {
  if (currentUser.role !== "caregiver") {
    throw new CustomError("Only caregivers can manage member SOS alerts", [], 403);
  }

  try {
    return await ensureParentMemberOrThrow(currentUser, memberId);
  } catch (error) {
    if (
      error instanceof CustomError &&
      (error.statusCode === 404 ||
        error.message === "Parent member not found")
    ) {
      throw new CustomError("You do not have access to this member", [], 403);
    }
    throw error;
  }
};

const findActiveSosForUser = async (userId) =>
  Sos.findOne({ userId, status: SOS_ACTIVE });

const notifySosAction = async ({
  parentUser,
  senderId,
  referenceId,
  title,
  body,
  sosStatus,
  createdAt,
  location,
}) => {
  await createActionNotificationsForParent({
    parentUserId: parentUser._id,
    senderId,
    type: "SOS",
    referenceId,
    title,
    body,
    data: buildSosFcmData({
      memberId: parentUser._id,
      sosStatus,
      createdAt,
      location,
    }),
    bypassDoNotDisturb: true,
  });
};

const emitLovedOneSosDashboardUpdate = async (
  parentUserId,
  sosStatus = null,
) => {
  await notifyDashboardUpdates([parentUserId], "recentData:sosStatus", {
    sosStatus: sosStatus || null,
  });

  const caregiverAudience = await getCaregiverAudienceForParent(parentUserId);
  if (caregiverAudience.length) {
    await notifyDashboardUpdates(caregiverAudience, "recentData:sosStatus");
  }
};

const emitCaregiverMemberSosStatus = async (parentUserId, sos, sosStatus) => {
  const caregiverAudience = await getCaregiverAudienceForParent(parentUserId);
  if (!caregiverAudience.length) {
    return;
  }

  const payload = await buildMemberSosStatusSocketPayload(sos, sosStatus);
  await notifyDashboardUpdates(
    caregiverAudience,
    "member:sosStatus",
    payload,
  );
};

const emitCaregiverSosAcknowledgement = async (
  parentUserId,
  acknowledgementPayload,
) => {
  const caregiverAudience = await getCaregiverAudienceForParent(parentUserId);
  if (!caregiverAudience.length) {
    return;
  }

  await notifyDashboardUpdates(
    caregiverAudience,
    "sos:acknowledgement",
    acknowledgementPayload,
  );
};

const triggerSosService = async (currentUser, payload = {}) => {
  const parentUser = await getParentSelfOrThrow(currentUser, payload.userId);

  const existingActive =
    parentUser.sosStatus === SOS_ACTIVE ||
    (await findActiveSosForUser(parentUser._id));

  if (existingActive) {
    throw new CustomError("An SOS alert is already active", [], 400);
  }

  const location = resolveSosLocation(payload, parentUser);
  let sos;

  try {
    sos = await Sos.create({
      userId: parentUser._id,
      familyId: parentUser.familyId || null,
      status: SOS_ACTIVE,
      location,
      acknowledgements: [],
      triggeredBy: parentUser._id,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new CustomError("An SOS alert is already active", [], 400);
    }
    throw error;
  }

  parentUser.sosStatus = SOS_ACTIVE;
  await parentUser.save();

  await emitLovedOneSosDashboardUpdate(parentUser._id, SOS_ACTIVE);
  await emitCaregiverMemberSosStatus(parentUser._id, sos, SOS_ACTIVE);

  await notifySosAction({
    parentUser,
    senderId: parentUser._id,
    referenceId: sos._id,
    title: "SOS alert",
    body: `${parentUser.name} triggered an SOS alert.`,
    sosStatus: SOS_ACTIVE,
    createdAt: sos.createdAt,
    location: sos.location,
  });

  return {
    sosId: sos._id,
    sosStatus: SOS_ACTIVE,
  };
};

const cancelSosService = async (currentUser, payload = {}) => {
  const parentUser = await getParentSelfOrThrow(currentUser, payload.userId);
  const activeSos = await findActiveSosForUser(parentUser._id);

  if (!activeSos && parentUser.sosStatus !== SOS_ACTIVE) {
    throw new CustomError("No active SOS alert to cancel", [], 400);
  }

  if (activeSos) {
    activeSos.status = SOS_CANCELLED;
    activeSos.cancelledBy = parentUser._id;
    activeSos.cancelledAt = new Date();
    await activeSos.save();
  }

  parentUser.sosStatus = null;
  await parentUser.save();

  const sosForEmit =
    activeSos ||
    ({
      userId: parentUser._id,
      createdAt: new Date(),
      location: null,
      acknowledgements: [],
    });

  await emitLovedOneSosDashboardUpdate(parentUser._id, null);
  await emitCaregiverMemberSosStatus(
    parentUser._id,
    sosForEmit,
    SOS_CANCELLED,
  );

  await notifySosAction({
    parentUser,
    senderId: parentUser._id,
    referenceId: activeSos?._id || parentUser._id,
    title: "SOS cancelled",
    body: `${parentUser.name} cancelled their SOS alert.`,
    sosStatus: SOS_CANCELLED,
    createdAt: activeSos?.createdAt || new Date(),
    location: activeSos?.location || null,
  });

  return {
    sosId: activeSos?._id || null,
    sosStatus: null,
  };
};

const acknowledgeSosService = async (currentUser, memberId) => {
  const parentUser = await getCaregiverMemberOrThrow(currentUser, memberId);
  const caregiverId = String(currentUser._id || currentUser.id);
  const activeSos = await findActiveSosForUser(parentUser._id);

  if (!activeSos) {
    throw new CustomError("No active SOS alert for this member", [], 400);
  }

  const alreadyAcknowledged = (activeSos.acknowledgements || []).some(
    (item) => String(item.caregiverId) === caregiverId,
  );

  if (alreadyAcknowledged) {
    return { alreadyAcknowledged: true };
  }

  const acknowledgedAt = new Date();
  activeSos.acknowledgements.push({
    caregiverId,
    acknowledgedAt,
  });
  await activeSos.save();

  const acknowledgementPayload = {
    memberId: String(parentUser._id),
    caregiverId,
    status: "acknowledged",
    acknowledgedAt: toIsoString(acknowledgedAt),
  };

  await emitCaregiverSosAcknowledgement(parentUser._id, acknowledgementPayload);

  return {
    alreadyAcknowledged: false,
    acknowledgement: acknowledgementPayload,
  };
};

const resolveSosService = async (currentUser, memberId) => {
  const parentUser = await getCaregiverMemberOrThrow(currentUser, memberId);
  const activeSos = await findActiveSosForUser(parentUser._id);

  if (!activeSos && parentUser.sosStatus !== SOS_ACTIVE) {
    throw new CustomError("No active SOS alert for this member", [], 400);
  }

  if (activeSos) {
    activeSos.status = SOS_RESOLVED;
    activeSos.resolvedBy = currentUser._id || currentUser.id;
    activeSos.resolvedAt = new Date();
    await activeSos.save();
  }

  parentUser.sosStatus = null;
  await parentUser.save();

  const sosForEmit =
    activeSos ||
    ({
      userId: parentUser._id,
      createdAt: new Date(),
      location: null,
      acknowledgements: [],
    });

  await emitLovedOneSosDashboardUpdate(parentUser._id, null);
  await emitCaregiverMemberSosStatus(parentUser._id, sosForEmit, SOS_RESOLVED);

  await notifySosAction({
    parentUser,
    senderId: currentUser._id || currentUser.id,
    referenceId: activeSos?._id || parentUser._id,
    title: "SOS resolved",
    body: `${parentUser.name}'s emergency was marked as resolved.`,
    sosStatus: SOS_RESOLVED,
    createdAt: activeSos?.createdAt || new Date(),
    location: activeSos?.location || null,
  });

  return {
    sosId: activeSos?._id || null,
    sosStatus: null,
  };
};

const cancelMemberSosService = async (currentUser, memberId) => {
  const parentUser = await getCaregiverMemberOrThrow(currentUser, memberId);
  const activeSos = await findActiveSosForUser(parentUser._id);

  if (!activeSos && parentUser.sosStatus !== SOS_ACTIVE) {
    throw new CustomError("No active SOS alert for this member", [], 400);
  }

  if (activeSos) {
    activeSos.status = SOS_CANCELLED;
    activeSos.cancelledBy = currentUser._id || currentUser.id;
    activeSos.cancelledAt = new Date();
    await activeSos.save();
  }

  parentUser.sosStatus = null;
  await parentUser.save();

  const sosForEmit =
    activeSos ||
    ({
      userId: parentUser._id,
      createdAt: new Date(),
      location: null,
      acknowledgements: [],
    });

  await emitLovedOneSosDashboardUpdate(parentUser._id, null);
  await emitCaregiverMemberSosStatus(
    parentUser._id,
    sosForEmit,
    SOS_CANCELLED,
  );

  await notifySosAction({
    parentUser,
    senderId: currentUser._id || currentUser.id,
    referenceId: activeSos?._id || parentUser._id,
    title: "SOS cancelled",
    body: `${parentUser.name}'s SOS alert was dismissed as a false alarm.`,
    sosStatus: SOS_CANCELLED,
    createdAt: activeSos?.createdAt || new Date(),
    location: activeSos?.location || null,
  });

  return {
    sosId: activeSos?._id || null,
    sosStatus: null,
  };
};

module.exports = {
  triggerSosService,
  cancelSosService,
  cancelMemberSosService,
  acknowledgeSosService,
  resolveSosService,
  SOS_ACTIVE,
  SOS_CANCELLED,
  SOS_RESOLVED,
};
