const User = require("../../models/user");
const Sos = require("../../models/sos");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { hasValidCoordinates } = require("../../utils/location");

const toIsoString = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatSosLocation = (location) => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const plain =
    typeof location.toObject === "function" ? location.toObject() : location;

  const formatted = {
    latitude: plain.latitude ?? null,
    longitude: plain.longitude ?? null,
    accuracy: plain.accuracy ?? null,
    address: plain.address ?? null,
    city: plain.city ?? null,
    state: plain.state ?? null,
    country: plain.country ?? null,
    postalCode: plain.postalCode ?? null,
  };

  const hasValue = Object.values(formatted).some(
    (value) => value !== null && value !== undefined && value !== "",
  );

  return hasValue ? formatted : null;
};

const getFamilyCaregiverIds = async (familyId) => {
  if (!familyId) {
    return [];
  }

  const caregivers = await User.find({
    familyId,
    role: "caregiver",
    ...ACTIVE_USER_FILTER,
  })
    .select("_id")
    .lean();

  return caregivers.map((caregiver) => String(caregiver._id));
};

const buildSosAcknowledgements = async (sos) => {
  if (!sos) {
    return [];
  }

  const caregiverIds = await getFamilyCaregiverIds(sos.familyId);
  const ackByCaregiverId = new Map(
    (sos.acknowledgements || []).map((item) => [
      String(item.caregiverId),
      item,
    ]),
  );

  return caregiverIds.map((caregiverId) => {
    const acknowledgement = ackByCaregiverId.get(caregiverId);
    if (acknowledgement) {
      return {
        caregiverId,
        status: "acknowledged",
        acknowledgedAt: toIsoString(acknowledgement.acknowledgedAt),
      };
    }

    return {
      caregiverId,
      status: "pending",
    };
  });
};

const buildActiveSosSnapshot = async (sos) => {
  if (!sos) {
    return {
      sosStatus: null,
      sosTriggeredAt: null,
      sosLocation: null,
      sosAcknowledgements: [],
    };
  }

  return {
    sosStatus: "active",
    sosTriggeredAt: toIsoString(sos.createdAt),
    sosLocation: formatSosLocation(sos.location),
    sosAcknowledgements: await buildSosAcknowledgements(sos),
  };
};

const findActiveSosByUserIds = async (userIds = []) => {
  if (!userIds.length) {
    return new Map();
  }

  const records = await Sos.find({
    userId: { $in: userIds },
    status: "active",
  }).lean();

  return records.reduce((accumulator, item) => {
    accumulator.set(String(item.userId), item);
    return accumulator;
  }, new Map());
};

const buildMemberSosStatusSocketPayload = async (sos, sosStatus) => {
  const memberId = String(sos.userId);

  if (sosStatus === "cancelled" || sosStatus === "resolved") {
    return {
      memberId,
      sosStatus,
    };
  }

  const acknowledgements = await buildSosAcknowledgements(sos);
  const location = formatSosLocation(sos.location);
  const payload = {
    memberId,
    sosStatus: "active",
    createdAt: toIsoString(sos.createdAt),
    acknowledgements,
  };

  if (location && hasValidCoordinates(location)) {
    payload.location = location;
  } else if (location) {
    payload.location = location;
  }

  return payload;
};

const buildSosFcmData = ({ memberId, sosStatus, createdAt, location }) => {
  const data = {
    memberId: String(memberId),
    sosStatus: String(sosStatus),
    createdAt: toIsoString(createdAt) || new Date().toISOString(),
  };

  const formattedLocation = formatSosLocation(location);
  if (formattedLocation) {
    data.location = JSON.stringify(formattedLocation);
  }

  return data;
};

module.exports = {
  formatSosLocation,
  buildSosAcknowledgements,
  buildActiveSosSnapshot,
  findActiveSosByUserIds,
  buildMemberSosStatusSocketPayload,
  buildSosFcmData,
  toIsoString,
};
