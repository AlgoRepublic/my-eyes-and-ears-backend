const sendRemindParentNotification = async ({
  parentUser,
  caregiverUser,
  appointment = null,
  payload = {},
}) => {
  const caregiverName = caregiverUser.name || "Your caregiver";
  const defaultTitle = appointment
    ? "Appointment reminder"
    : "Reminder from your caregiver";
  const defaultMessage = appointment
    ? `${caregiverName} sent you a reminder for your appointment with ${appointment.doctorName}.`
    : `${caregiverName} sent you a reminder.`;

  // FCM delivery will be wired here later.
  return {
    delivered: false,
    channel: "fcm",
    parentUserId: parentUser._id,
    caregiverUserId: caregiverUser._id,
    appointmentId: appointment ? appointment._id : null,
    appointment: appointment
      ? {
          id: appointment._id,
          doctorName: appointment.doctorName,
          reason: appointment.reason,
          date: appointment.date,
          time: appointment.time,
          location: appointment.location,
        }
      : null,
    title: payload.title || defaultTitle,
    message: payload.message || defaultMessage,
    type: payload.type || "general",
    sentAt: new Date(),
  };
};

module.exports = {
  sendRemindParentNotification,
};
