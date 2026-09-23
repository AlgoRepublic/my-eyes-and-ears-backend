const Appointment = require("../../../models/appointment");
const {
  upsertScheduledNotifications,
  cancelFutureNotifications,
} = require("../notification.service");
const {
  getAppointmentOccurrences,
} = require("../scheduleCalculator");
const { appointmentReminder } = require("../templates");

const syncAppointmentNotifications = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment) {
    return [];
  }

  if (
    appointment.status === "completed" ||
    appointment.status === "cancelled"
  ) {
    await cancelFutureNotifications({
      type: "appointment",
      referenceId: appointment._id,
    });
    return [];
  }

  const occurrences = getAppointmentOccurrences(appointment);
  const content = appointmentReminder({
    doctorName: appointment.doctorName,
    timeLabel: appointment.time,
  });

  return upsertScheduledNotifications({
    type: "appointment",
    referenceId: appointment._id,
    parentUserId: appointment.userId,
    occurrences,
    includeCaregivers: true,
    buildContent: () => ({
      ...content,
      data: {
        type: "appointment",
        referenceId: String(appointment._id),
        doctorName: appointment.doctorName,
      },
    }),
  });
};

module.exports = {
  syncAppointmentNotifications,
};
