const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const { getUtcDateTimeFromDateAndTime } = require("../../utils/utcDateTime");

const COMPLETED_STATUS = "completed";
const CANCELLED_STATUS = "cancelled";
const SCHEDULED_STATUS = "scheduled";
const CONFIRMED_STATUS = "confirmed";
const RESCHEDULED_STATUS = "rescheduled";
const UPCOMING_STATUS = "upcoming";
const MISSED_STATUS = "missed";

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  SCHEDULED_STATUS,
  CONFIRMED_STATUS,
  RESCHEDULED_STATUS,
]);

const getAppointmentDateTime = (appointment) => {
  return getUtcDateTimeFromDateAndTime(appointment?.date, appointment?.time);
};

const getComputedAppointmentStatus = (appointment, now = new Date()) => {
  if (appointment.status === COMPLETED_STATUS) {
    return COMPLETED_STATUS;
  }

  if (appointment.status === CANCELLED_STATUS) {
    return CANCELLED_STATUS;
  }

  if (appointment.status === SCHEDULED_STATUS) {
    const appointmentDateTime = getAppointmentDateTime(appointment);

    if (!appointmentDateTime) {
      return UPCOMING_STATUS;
    }

    return appointmentDateTime > now ? UPCOMING_STATUS : MISSED_STATUS;
  }

  if (
    appointment.status === CONFIRMED_STATUS ||
    appointment.status === RESCHEDULED_STATUS
  ) {
    return appointment.status;
  }

  return appointment.status;
};

const mapAppointmentResponse = (appointment, status) => {
  return {
    id: appointment._id,
    userId: appointment.userId,
    doctorName: appointment.doctorName,
    reason: appointment.reason,
    date: appointment.date,
    time: appointment.time,
    location: appointment.location,
    clinicPhone: appointment.clinicPhone,
    note: appointment.note,
    rider: appointment.rider,
    status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
};

const sortByAppointmentDateTimeAsc = (left, right) => {
  const leftDateTime = getAppointmentDateTime(left);
  const rightDateTime = getAppointmentDateTime(right);

  if (!leftDateTime && !rightDateTime) return 0;
  if (!leftDateTime) return 1;
  if (!rightDateTime) return -1;

  return leftDateTime.getTime() - rightDateTime.getTime();
};

const getDashboardAppointments = async (userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const rawAppointments = await Appointment.find({ userId });
  const sortedAppointments = [...rawAppointments].sort(
    sortByAppointmentDateTimeAsc,
  );
  const now = new Date();

  const appointments = sortedAppointments.map((appointment) => {
    const computedStatus = getComputedAppointmentStatus(appointment, now);
    return mapAppointmentResponse(appointment, computedStatus);
  });

  const upcomingAppointment =
    appointments.find(
      (appointment) => appointment.status === UPCOMING_STATUS,
    ) || null;

  return {
    upcomingAppointment,
    appointments,
  };
};

module.exports = {
  COMPLETED_STATUS,
  CANCELLED_STATUS,
  SCHEDULED_STATUS,
  CONFIRMED_STATUS,
  RESCHEDULED_STATUS,
  ACTIVE_APPOINTMENT_STATUSES,
  getDashboardAppointments,
  getComputedAppointmentStatus,
  mapAppointmentResponse,
  sortByAppointmentDateTimeAsc,
};
