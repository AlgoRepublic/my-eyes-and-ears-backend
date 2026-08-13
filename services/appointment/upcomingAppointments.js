const Appointment = require("../../models/appointment");
const { CustomError } = require("../../utils/error");
const { getUtcStartOfDay } = require("../../utils/utcDateTime");
const {
  getComputedAppointmentStatus,
  mapAppointmentResponse,
  sortByAppointmentDateTimeAsc,
} = require("./dashboardAppointments");

const formatUpcomingAppointments = (rawAppointments, now = new Date()) => {
  const sortedAppointments = [...rawAppointments].sort(
    sortByAppointmentDateTimeAsc,
  );

  return sortedAppointments.map((appointment) => {
    const computedStatus = getComputedAppointmentStatus(appointment, now);
    return mapAppointmentResponse(appointment, computedStatus);
  });
};

const getUpcomingAppointmentsResponse = async (userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const now = new Date();
  const todayStart = getUtcStartOfDay(now);

  const rawAppointments = await Appointment.find({
    userId,
    status: { $nin: ["completed", "cancelled"] },
    date: { $gte: todayStart },
  });

  return {
    appointments: formatUpcomingAppointments(rawAppointments, now),
  };
};

module.exports = {
  formatUpcomingAppointments,
  getUpcomingAppointmentsResponse,
};
