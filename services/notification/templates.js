const medicationReminder = ({ medicationName }) => ({
  title: "Medication Reminder",
  body: medicationName
    ? `It's time to take your ${medicationName}.`
    : "It's time to take your medication.",
});

const appointmentReminder = ({ doctorName, timeLabel }) => ({
  title: "Appointment Reminder",
  body: doctorName
    ? `You have an appointment with ${doctorName}${timeLabel ? ` at ${timeLabel}` : ""}.`
    : "You have an upcoming appointment.",
});

const checkinReminder = ({ label }) => ({
  title: "Check-in Reminder",
  body: label
    ? `It's time for your check-in: ${label}.`
    : "It's time for your daily check-in.",
});

const caregiverReminder = ({ caregiverName, message }) => ({
  title: "Reminder from your caregiver",
  body:
    message ||
    `${caregiverName || "Your caregiver"} sent you a reminder.`,
});

module.exports = {
  medicationReminder,
  appointmentReminder,
  checkinReminder,
  caregiverReminder,
};
