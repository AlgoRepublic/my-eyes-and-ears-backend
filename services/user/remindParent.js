const User = require("../../models/user");
const Appointment = require("../../models/appointment");
const Medication = require("../../models/medication");
const CheckinReminder = require("../../models/checkinReminder");
const { CustomError } = require("../../utils/error");
const {
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
} = require("./memberAccess");
const {
  sendRemindParentNotification,
} = require("../notification/remindParent");

const REMIND_TYPES = new Set([
  "general",
  "checkin",
  "medication",
  "appointment",
]);

const TARGET_ID_FIELDS = [
  { field: "appointmentId", type: "appointment" },
  { field: "medicationId", type: "medication" },
  { field: "checkinId", type: "checkin" },
];

const normalizeOptionalId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const loadParentAppointmentOrThrow = async (parentUserId, appointmentId) => {
  const normalizedAppointmentId = ensureObjectIdOrThrow(
    appointmentId,
    "appointmentId",
  );

  const appointment = await Appointment.findOne({
    _id: normalizedAppointmentId,
    userId: parentUserId,
  });

  if (!appointment) {
    throw new CustomError("Appointment not found", [], 404);
  }

  return appointment;
};

const loadParentMedicationOrThrow = async (parentUserId, medicationId) => {
  const normalizedMedicationId = ensureObjectIdOrThrow(
    medicationId,
    "medicationId",
  );

  const medication = await Medication.findOne({
    _id: normalizedMedicationId,
    userId: parentUserId,
    isActive: true,
  });

  if (!medication) {
    throw new CustomError("Medication not found", [], 404);
  }

  return medication;
};

const loadParentCheckinOrThrow = async (parentUserId, checkinId) => {
  const normalizedCheckinId = ensureObjectIdOrThrow(checkinId, "checkinId");

  const checkin = await CheckinReminder.findOne({
    _id: normalizedCheckinId,
    userId: parentUserId,
    isEnabled: true,
  });

  if (!checkin) {
    throw new CustomError("Checkin reminder not found", [], 404);
  }

  return checkin;
};

const resolveReminderTarget = (payload = {}) => {
  const providedTargets = TARGET_ID_FIELDS.filter(({ field }) =>
    Boolean(normalizeOptionalId(payload[field])),
  );

  if (providedTargets.length > 1) {
    throw new CustomError(
      "Only one of appointmentId, medicationId, or checkinId can be provided",
      [],
      400,
    );
  }

  const inferredType = providedTargets[0]?.type || "general";
  const explicitType = payload.type
    ? String(payload.type).trim().toLowerCase()
    : null;
  const type = explicitType || inferredType;

  if (!REMIND_TYPES.has(type)) {
    throw new CustomError("Invalid reminder type", [], 400);
  }

  if (type === "general" && providedTargets.length > 0) {
    throw new CustomError(
      "type general cannot be used with appointmentId, medicationId, or checkinId",
      [],
      400,
    );
  }

  if (type !== "general" && providedTargets.length === 0) {
    throw new CustomError(
      `${type}Id is required when type is ${type}`,
      [],
      400,
    );
  }

  if (
    providedTargets.length === 1 &&
    explicitType &&
    explicitType !== providedTargets[0].type
  ) {
    throw new CustomError(
      `type must match the provided ${providedTargets[0].field}`,
      [],
      400,
    );
  }

  return {
    type,
    appointmentId: normalizeOptionalId(payload.appointmentId),
    medicationId: normalizeOptionalId(payload.medicationId),
    checkinId: normalizeOptionalId(payload.checkinId),
  };
};

const remindParentService = async (currentUser, userId, payload = {}) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const parentUser = await ensureParentMemberOrThrow(currentUser, userId);
  const caregiverUser = await User.findById(
    currentUser?._id || currentUser?.id,
  ).select("_id name role");

  if (!caregiverUser) {
    throw new CustomError("Authenticated caregiver is required", [], 401);
  }

  const { type, appointmentId, medicationId, checkinId } =
    resolveReminderTarget(payload);

  let appointment = null;
  let medication = null;
  let checkin = null;

  if (type === "appointment") {
    appointment = await loadParentAppointmentOrThrow(
      parentUser._id,
      appointmentId,
    );
  }

  if (type === "medication") {
    medication = await loadParentMedicationOrThrow(
      parentUser._id,
      medicationId,
    );
  }

  if (type === "checkin") {
    checkin = await loadParentCheckinOrThrow(parentUser._id, checkinId);
  }

  const title = payload.title ? String(payload.title).trim() : null;
  const message = payload.message ? String(payload.message).trim() : null;

  const notification = await sendRemindParentNotification({
    parentUser,
    caregiverUser,
    appointment,
    medication,
    checkin,
    payload: {
      type,
      title,
      message,
      appointmentId: appointment ? String(appointment._id) : null,
      medicationId: medication ? String(medication._id) : null,
      checkinId: checkin ? String(checkin._id) : null,
    },
  });

  return {
    parentUserId: String(parentUser._id),
    caregiverUserId: String(caregiverUser._id),
    type,
    appointmentId: appointment ? String(appointment._id) : null,
    medicationId: medication ? String(medication._id) : null,
    checkinId: checkin ? String(checkin._id) : null,
    notification,
  };
};

module.exports = {
  remindParentService,
  REMIND_TYPES,
};
