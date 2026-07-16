const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");

const COMPLETED_STATUS = "completed";
const CANCELLED_STATUS = "cancelled";
const SCHEDULED_STATUS = "scheduled";
const UPCOMING_STATUS = "upcoming";
const MISSED_STATUS = "missed";

const parseTimeParts = (timeValue) => {
  if (!timeValue) return null;

  const raw = String(timeValue).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return { hours, minutes };
};

const getAppointmentDateTime = (appointment) => {
  if (!appointment?.date) return null;

  const baseDate = new Date(appointment.date);
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const timeParts = parseTimeParts(appointment.time);
  if (!timeParts) {
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  );
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
  getDashboardAppointments,
  getComputedAppointmentStatus,
};
