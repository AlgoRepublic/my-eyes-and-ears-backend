const User = require("../../models/user");
const Appointment = require("../../models/appointment");
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

  const appointmentId = payload.appointmentId
    ? String(payload.appointmentId).trim()
    : null;

  const type = payload.type
    ? String(payload.type).trim().toLowerCase()
    : appointmentId
      ? "appointment"
      : "general";

  if (!REMIND_TYPES.has(type)) {
    throw new CustomError("Invalid reminder type", [], 400);
  }

  if (type === "appointment" && !appointmentId) {
    throw new CustomError(
      "appointmentId is required when type is appointment",
      [],
      400,
    );
  }

  let appointment = null;
  if (appointmentId) {
    appointment = await loadParentAppointmentOrThrow(
      parentUser._id,
      appointmentId,
    );
  }

  const title = payload.title ? String(payload.title).trim() : null;
  const message = payload.message ? String(payload.message).trim() : null;

  const notification = await sendRemindParentNotification({
    parentUser,
    caregiverUser,
    appointment,
    payload: {
      type,
      title,
      message,
      appointmentId: appointment ? String(appointment._id) : null,
    },
  });

  return {
    parentUserId: String(parentUser._id),
    caregiverUserId: String(caregiverUser._id),
    appointmentId: appointment ? String(appointment._id) : null,
    notification,
  };
};

module.exports = {
  remindParentService,
  REMIND_TYPES,
};
