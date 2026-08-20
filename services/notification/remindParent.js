const buildDefaultReminderContent = ({
  caregiverName,
  type,
  appointment,
  medication,
  checkin,
}) => {
  if (type === "appointment" && appointment) {
    return {
      title: "Appointment reminder",
      message: `${caregiverName} sent you a reminder for your appointment with ${appointment.doctorName}.`,
    };
  }

  if (type === "medication" && medication) {
    const medicationLabel = medication.dosage
      ? `${medication.name} (${medication.dosage})`
      : medication.name;

    return {
      title: "Medication reminder",
      message: `${caregiverName} sent you a reminder to take ${medicationLabel}.`,
    };
  }

  if (type === "checkin" && checkin) {
    const checkinLabel = checkin.label || "your daily check-in";

    return {
      title: "Check-in reminder",
      message: `${caregiverName} sent you a reminder for ${checkinLabel}.`,
    };
  }

  return {
    title: "Reminder from your caregiver",
    message: `${caregiverName} sent you a reminder.`,
  };
};

const sendRemindParentNotification = async ({
  parentUser,
  caregiverUser,
  appointment = null,
  medication = null,
  checkin = null,
  payload = {},
}) => {
  const caregiverName = caregiverUser.name || "Your caregiver";
  const type = payload.type || "general";
  const defaults = buildDefaultReminderContent({
    caregiverName,
    type,
    appointment,
    medication,
    checkin,
  });

  // FCM delivery will be wired here later.
  return {
    delivered: false,
    channel: "fcm",
    parentUserId: parentUser._id,
    caregiverUserId: caregiverUser._id,
    appointmentId: appointment ? appointment._id : null,
    medicationId: medication ? medication._id : null,
    checkinId: checkin ? checkin._id : null,
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
    medication: medication
      ? {
          id: medication._id,
          name: medication.name,
          dosage: medication.dosage,
          time: medication.time,
        }
      : null,
    checkin: checkin
      ? {
          id: checkin._id,
          time: checkin.time,
          label: checkin.label,
        }
      : null,
    title: payload.title || defaults.title,
    message: payload.message || defaults.message,
    type,
    sentAt: new Date(),
  };
};

module.exports = {
  sendRemindParentNotification,
};
