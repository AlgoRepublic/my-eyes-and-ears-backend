const { syncMedicationNotifications } = require("./medication.sync");
const { syncAppointmentNotifications } = require("./appointment.sync");
const { syncCheckinNotifications } = require("./checkin.sync");

const runNotificationSync = (promise) => {
  promise.catch((error) => {
    console.error(
      JSON.stringify({
        event: "notification_sync_error",
        message: error?.message || "unknown_error",
        timestamp: new Date().toISOString(),
      }),
    );
  });
};

module.exports = {
  syncMedicationNotifications: (id) =>
    runNotificationSync(syncMedicationNotifications(id)),
  syncAppointmentNotifications: (id) =>
    runNotificationSync(syncAppointmentNotifications(id)),
  syncCheckinNotifications: (id) =>
    runNotificationSync(syncCheckinNotifications(id)),
};
