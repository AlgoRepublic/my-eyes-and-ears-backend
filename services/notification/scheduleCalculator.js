const notificationConfig = require("../../config/notification");
const {
  getUtcDateTimeFromDateAndTime,
  getUtcDateTimeForTodayCheckin,
  getUtcStartOfDay,
  getUtcWeekDayName,
  isSameUtcDay,
} = require("../../utils/utcDateTime");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getHorizonEnd = (now = new Date()) => {
  return new Date(
    now.getTime() + notificationConfig.horizonDays * MS_PER_DAY,
  );
};

const isWithinMedicationWindow = (medication, dayStart) => {
  if (medication.startDate && medication.startDate > dayStart) {
    return false;
  }

  if (!medication.endDate) {
    return true;
  }

  return getUtcStartOfDay(medication.endDate) >= dayStart;
};

const getMedicationOccurrences = (medication, now = new Date()) => {
  if (!medication?.isActive || !medication.time) {
    return [];
  }

  const horizonEnd = getHorizonEnd(now);
  const occurrences = [];
  const cursor = getUtcStartOfDay(now);

  while (cursor <= horizonEnd) {
    if (!isWithinMedicationWindow(medication, cursor)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }

    let applicable = false;

    if (medication.frequency === "daily") {
      applicable = true;
    } else if (medication.frequency === "weekly") {
      const weekDay = getUtcWeekDayName(cursor);
      applicable = (medication.days || []).includes(weekDay);
    } else if (
      medication.frequency === "once" ||
      medication.frequency === "custom_dates"
    ) {
      applicable = (medication.dates || []).some((dateValue) =>
        isSameUtcDay(new Date(dateValue), cursor),
      );
    }

    if (applicable) {
      const scheduledAt = getUtcDateTimeForTodayCheckin(
        medication.time,
        cursor,
      );
      if (scheduledAt && scheduledAt >= now && scheduledAt <= horizonEnd) {
        occurrences.push(scheduledAt);
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
};

const getAppointmentOccurrences = (appointment, now = new Date()) => {
  if (!appointment?.date) {
    return [];
  }

  if (appointment.status === "completed" || appointment.status === "cancelled") {
    return [];
  }

  const scheduledAt = getUtcDateTimeFromDateAndTime(
    appointment.date,
    appointment.time,
  );

  if (!scheduledAt) {
    return [];
  }

  const reminderAt = new Date(
    scheduledAt.getTime() - notificationConfig.appointmentReminderOffsetMs,
  );

  if (reminderAt < now || reminderAt > getHorizonEnd(now)) {
    return [];
  }

  return [reminderAt];
};

const getCheckinOccurrences = (checkinReminder, now = new Date()) => {
  if (!checkinReminder?.isEnabled || !checkinReminder.time) {
    return [];
  }

  const horizonEnd = getHorizonEnd(now);
  const occurrences = [];
  const cursor = getUtcStartOfDay(now);

  while (cursor <= horizonEnd) {
    const scheduledAt = getUtcDateTimeForTodayCheckin(
      checkinReminder.time,
      cursor,
    );

    if (scheduledAt && scheduledAt >= now && scheduledAt <= horizonEnd) {
      occurrences.push(scheduledAt);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return occurrences;
};

module.exports = {
  getHorizonEnd,
  getMedicationOccurrences,
  getAppointmentOccurrences,
  getCheckinOccurrences,
};
