const Medication = require("../../../models/medication");
const {
  upsertScheduledNotifications,
  cancelFutureNotifications,
} = require("../notification.service");
const {
  getMedicationOccurrences,
} = require("../scheduleCalculator");
const { medicationReminder } = require("../templates");

const syncMedicationNotifications = async (medicationId) => {
  const medication = await Medication.findById(medicationId).lean();
  if (!medication) {
    return [];
  }

  if (!medication.isActive) {
    await cancelFutureNotifications({
      type: "medication",
      referenceId: medication._id,
    });
    return [];
  }

  const occurrences = getMedicationOccurrences(medication);
  const content = medicationReminder({ medicationName: medication.name });

  return upsertScheduledNotifications({
    type: "medication",
    referenceId: medication._id,
    parentUserId: medication.userId,
    occurrences,
    buildContent: () => ({
      ...content,
      data: {
        type: "medication",
        referenceId: String(medication._id),
        medicationName: medication.name,
      },
    }),
  });
};

module.exports = {
  syncMedicationNotifications,
};
