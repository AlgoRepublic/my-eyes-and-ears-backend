const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const {
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
} = require("./memberAccess");
const { parseDateInputToUtc } = require("../../utils/utcDateTime");

const mapAppointment = (item) => ({
  id: item._id,
  userId: item.userId,
  doctorName: item.doctorName,
  reason: item.reason,
  date: item.date,
  time: item.time,
  location: item.location,
  clinicPhone: item.clinicPhone,
  note: item.note,
  rider: item.rider,
  status: item.status,
});

const toDateOrNull = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedDate = parseDateInputToUtc(value);
  if (!parsedDate) {
    throw new CustomError(`${fieldName} must be a valid date`, [], 400);
  }

  return parsedDate;
};

const createMemberAppointmentService = async (
  currentUser,
  memberId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const doctorName = String(payload.doctorName || "").trim();

  if (!doctorName) {
    throw new CustomError("doctorName is required", [], 400);
  }

  const appointment = await Appointment.create({
    userId: parentUser._id,
    doctorName,
    reason: payload.reason ? String(payload.reason).trim() : null,
    date: toDateOrNull(payload.date, "date"),
    time: payload.time ? String(payload.time).trim() : null,
    location: payload.location ? String(payload.location).trim() : null,
    clinicPhone: payload.clinicPhone
      ? String(payload.clinicPhone).trim()
      : null,
    note: payload.note ? String(payload.note).trim() : null,
    rider: payload.rider ? String(payload.rider).trim() : null,
    status: payload.status ? String(payload.status).trim() : "scheduled",
  });

  return {
    appointment: mapAppointment(appointment),
  };
};

const updateMemberAppointmentService = async (
  currentUser,
  memberId,
  appointmentId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedAppointmentId = ensureObjectIdOrThrow(
    appointmentId,
    "appointmentId",
  );

  const appointment = await Appointment.findOne({
    _id: normalizedAppointmentId,
    userId: parentUser._id,
  });

  if (!appointment) {
    throw new CustomError("Appointment not found", [], 404);
  }

  if (payload.doctorName !== undefined) {
    const doctorName = String(payload.doctorName || "").trim();
    if (!doctorName) {
      throw new CustomError("doctorName cannot be empty", [], 400);
    }
    appointment.doctorName = doctorName;
  }

  if (payload.reason !== undefined) {
    appointment.reason = payload.reason ? String(payload.reason).trim() : null;
  }

  if (payload.date !== undefined) {
    appointment.date = toDateOrNull(payload.date, "date");
  }

  if (payload.time !== undefined) {
    appointment.time = payload.time ? String(payload.time).trim() : null;
  }

  if (payload.location !== undefined) {
    appointment.location = payload.location
      ? String(payload.location).trim()
      : null;
  }

  if (payload.clinicPhone !== undefined) {
    appointment.clinicPhone = payload.clinicPhone
      ? String(payload.clinicPhone).trim()
      : null;
  }

  if (payload.note !== undefined) {
    appointment.note = payload.note ? String(payload.note).trim() : null;
  }

  if (payload.rider !== undefined) {
    appointment.rider = payload.rider ? String(payload.rider).trim() : null;
  }

  if (payload.status !== undefined) {
    appointment.status = payload.status
      ? String(payload.status).trim()
      : "scheduled";
  }

  await appointment.save();

  return {
    appointment: mapAppointment(appointment),
  };
};

const deleteMemberAppointmentService = async (
  currentUser,
  memberId,
  appointmentId,
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedAppointmentId = ensureObjectIdOrThrow(
    appointmentId,
    "appointmentId",
  );

  const deleted = await Appointment.findOneAndDelete({
    _id: normalizedAppointmentId,
    userId: parentUser._id,
  });

  if (!deleted) {
    throw new CustomError("Appointment not found", [], 404);
  }

  return {
    deletedAppointmentId: String(deleted._id),
  };
};

module.exports = {
  createMemberAppointmentService,
  updateMemberAppointmentService,
  deleteMemberAppointmentService,
};
