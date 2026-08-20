const CheckinReminder = require("../../../models/checkinReminder");
const {
  upsertScheduledNotifications,
  cancelFutureNotifications,
} = require("../notification.service");
const { getCheckinOccurrences } = require("../scheduleCalculator");
const { checkinReminder } = require("../templates");

const syncCheckinNotifications = async (checkinReminderId) => {
  const reminder = await CheckinReminder.findById(checkinReminderId).lean();
  if (!reminder) {
    return [];
  }

  if (!reminder.isEnabled) {
    await cancelFutureNotifications({
      type: "checkinReminder",
      referenceId: reminder._id,
    });
    return [];
  }

  const occurrences = getCheckinOccurrences(reminder);
  const content = checkinReminder({ label: reminder.label });

  return upsertScheduledNotifications({
    type: "checkinReminder",
    referenceId: reminder._id,
    parentUserId: reminder.userId,
    occurrences,
    buildContent: () => ({
      ...content,
      data: {
        type: "checkinReminder",
        referenceId: String(reminder._id),
        label: reminder.label || "",
      },
    }),
  });
};

module.exports = {
  syncCheckinNotifications,
};
