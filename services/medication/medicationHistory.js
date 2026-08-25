const Medication = require("../../models/medication");
const MedicationHistory = require("../../models/medicationHistory");
const { CustomError } = require("../../utils/error");
const { ensureParentUserAccessOrThrow } = require("../user/memberAccess");
const {
  getUtcDateTimeFromDateAndTime,
  getUtcDateTimeForTodayCheckin,
  getUtcStartOfDay,
  getUtcEndOfDayExclusive,
  getUtcWeekDayName,
  isSameUtcDay,
} = require("../../utils/utcDateTime");

const DUE_ACTIONS = ["taken", "skipped", "remind_later"];
const ALLOWED_STATUSES = new Set(["taken", "skipped", "remind_later"]);
const DATE_BASED_FREQUENCIES = new Set(["once", "custom_dates"]);

const isMedicationApplicableForToday = (medication, now = new Date()) => {
  if (medication.frequency === "weekly") {
    const selectedDays = Array.isArray(medication.days) ? medication.days : [];
    return selectedDays.includes(getUtcWeekDayName(now));
  }

  if (
    medication.frequency === "once" ||
    medication.frequency === "custom_dates"
  ) {
    const selectedDates = Array.isArray(medication.dates)
      ? medication.dates
      : [];

    return selectedDates.some((dateValue) => {
      const parsedDate = new Date(dateValue);
      if (Number.isNaN(parsedDate.getTime())) {
        return false;
      }

      return isSameUtcDay(parsedDate, now);
    });
  }

  return medication.frequency === "daily";
};

const getMedicationTimeOnToday = (medication, now = new Date()) => {
  if (!medication?.time) {
    return null;
  }

  return getUtcDateTimeForTodayCheckin(medication.time, now);
};

const getMedicationUpcomingDateTime = (medication, now = new Date()) => {
  if (!medication) {
    return null;
  }

  if (medication.status === "remind_later" && medication.remindAt) {
    const remindAt = new Date(medication.remindAt);
    if (!Number.isNaN(remindAt.getTime()) && remindAt > now) {
      return remindAt;
    }
  }

  const frequency = medication.frequency;

  if (DATE_BASED_FREQUENCIES.has(frequency)) {
    const selectedDates = Array.isArray(medication.dates) ? medication.dates : [];
    let nearestDateTime = null;

    for (const dateValue of selectedDates) {
      const dateTime = getUtcDateTimeFromDateAndTime(dateValue, medication.time);
      if (!dateTime || dateTime <= now) {
        continue;
      }

      if (!nearestDateTime || dateTime < nearestDateTime) {
        nearestDateTime = dateTime;
      }
    }

    return nearestDateTime;
  }

  if (frequency === "weekly") {
    const selectedDays = Array.isArray(medication.days) ? medication.days : [];
    if (!selectedDays.includes(getUtcWeekDayName(now))) {
      return null;
    }
  }

  if (frequency === "daily" || frequency === "weekly") {
    return getMedicationTimeOnToday(medication, now);
  }

  return getMedicationTimeOnToday(medication, now);
};

const getMedicationReminderDateTime = (medication, now = new Date()) => {
  if (!medication) {
    return null;
  }

  const frequency = medication.frequency;

  if (DATE_BASED_FREQUENCIES.has(frequency)) {
    const selectedDates = Array.isArray(medication.dates) ? medication.dates : [];

    for (const dateValue of selectedDates) {
      const parsedDate = new Date(dateValue);
      if (Number.isNaN(parsedDate.getTime()) || !isSameUtcDay(parsedDate, now)) {
        continue;
      }

      return getUtcDateTimeFromDateAndTime(dateValue, medication.time);
    }

    return null;
  }

  if (frequency === "weekly") {
    const selectedDays = Array.isArray(medication.days) ? medication.days : [];
    if (!selectedDays.includes(getUtcWeekDayName(now))) {
      return null;
    }
  }

  return getMedicationTimeOnToday(medication, now);
};

const isMedicationCompletedForToday = (medication) => {
  const status = medication?.status;
  return status === "taken" || status === "skipped";
};

const pickNearestUpcomingMedication = (medications = [], now = new Date()) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const medication of medications) {
    if (isMedicationCompletedForToday(medication)) {
      continue;
    }

    const dateTime = getMedicationUpcomingDateTime(medication, now);
    if (!dateTime || dateTime <= now) {
      continue;
    }

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = medication;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const deriveTemporalStatus = (medication, now = new Date()) => {
  const reminderAt = getMedicationReminderDateTime(medication, now);

  if (!reminderAt) {
    return "due";
  }

  return now > reminderAt ? "overdue" : "due";
};

const getActionsByStatus = (status) => {
  if (status === "due" || status === "overdue" || status === "remind_later") {
    return DUE_ACTIONS;
  }

  return [];
};

const mapMedicationResponse = (medication, status, remindAt = null) => {
  return {
    id: medication._id,
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    days: medication.days || [],
    dates: medication.dates || [],
    startDate: medication.startDate,
    endDate: medication.endDate,
    notes: medication.notes,
    time: medication.time,
    remindAt,
    status,
    actions: getActionsByStatus(status),
  };
};

const getTodayMedicationResponse = async (userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const dayStart = getUtcStartOfDay();
  const dayEndExclusive = getUtcEndOfDayExclusive();
  const now = new Date();

  const [medications, todayHistories] = await Promise.all([
    Medication.find({ userId, isActive: true }).sort({ createdAt: 1 }),
    MedicationHistory.find({
      userId,
      date: { $gte: dayStart, $lt: dayEndExclusive },
    })
      .select("medicationId status remindAt")
      .lean(),
  ]);

  const historyByMedicationId = todayHistories.reduce(
    (accumulator, historyItem) => {
      const medicationId = String(historyItem.medicationId);
      if (!accumulator.has(medicationId)) {
        accumulator.set(medicationId, {
          status: historyItem.status,
          remindAt: historyItem.remindAt,
        });
      }
      return accumulator;
    },
    new Map(),
  );

  const todayMedications = medications.filter((medication) =>
    isMedicationApplicableForToday(medication, now),
  );

  return todayMedications.map((medication) => {
    const history = historyByMedicationId.get(String(medication._id));

    let finalStatus = deriveTemporalStatus(medication, now);

    if (history?.status === "taken" || history?.status === "skipped") {
      finalStatus = history.status;
    } else if (history?.status === "remind_later") {
      const remindAt = history.remindAt ? new Date(history.remindAt) : null;
      if (remindAt && !Number.isNaN(remindAt.getTime()) && now > remindAt) {
        finalStatus = "overdue";
      } else {
        finalStatus = "remind_later";
      }
    }

    return mapMedicationResponse(
      medication,
      finalStatus,
      history?.remindAt ?? null,
    );
  });
};

const updateMedicationStatusService = async ({
  currentUser,
  userId,
  medicationId,
  status,
  remindAt,
}) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  if (!medicationId || !status) {
    throw new CustomError("medicationId and status are required", [], 400);
  }

  const parentUser = await ensureParentUserAccessOrThrow(currentUser, userId);

  const normalizedStatus = String(status).trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    throw new CustomError("Invalid status", [], 400);
  }

  let parsedRemindAt = null;
  if (normalizedStatus === "remind_later") {
    if (!remindAt) {
      throw new CustomError("remindAt is required for remind_later", [], 400);
    }

    parsedRemindAt = new Date(remindAt);
    if (Number.isNaN(parsedRemindAt.getTime())) {
      throw new CustomError("Invalid remindAt datetime", [], 400);
    }
  }

  const medication = await Medication.findOne({
    _id: medicationId,
    userId: parentUser._id,
    isActive: true,
  }).select("_id userId");

  if (!medication) {
    throw new CustomError("Medication not found", [], 404);
  }

  const now = new Date();
  const dayStart = getUtcStartOfDay(now);

  const update = {
    status: normalizedStatus,
    takenAt: null,
    skippedAt: null,
    remindAt: null,
  };

  if (normalizedStatus === "taken") {
    update.takenAt = now;
  }

  if (normalizedStatus === "skipped") {
    update.skippedAt = now;
  }

  if (normalizedStatus === "remind_later") {
    update.remindAt = parsedRemindAt;
  }

  const history = await MedicationHistory.findOneAndUpdate(
    {
      userId: medication.userId,
      medicationId: medication._id,
      date: dayStart,
    },
    {
      $set: update,
      $setOnInsert: {
        medicationId: medication._id,
        userId: medication.userId,
        date: dayStart,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );

  return {
    medicationId: history.medicationId,
    date: history.date,
    status: history.status,
    takenAt: history.takenAt,
    skippedAt: history.skippedAt,
    remindAt: history.remindAt,
    actions: [],
  };
};

module.exports = {
  getTodayMedicationResponse,
  updateMedicationStatusService,
  getMedicationUpcomingDateTime,
  pickNearestUpcomingMedication,
};
