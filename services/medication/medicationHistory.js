const Medication = require("../../models/medication");
const MedicationHistory = require("../../models/medicationHistory");
const { CustomError } = require("../../utils/error");

const DUE_ACTIONS = ["taken", "skipped", "remind_later"];
const ALLOWED_STATUSES = new Set(["taken", "skipped", "remind_later"]);

const getStartOfDay = (inputDate = new Date()) => {
  const date = new Date(inputDate);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getEndOfDayExclusive = (inputDate = new Date()) => {
  const start = getStartOfDay(inputDate);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
};

const parseMedicationTime = (timeValue, referenceDate = new Date()) => {
  if (!timeValue) return null;

  const raw = String(timeValue).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "AM") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    hours,
    minutes,
    0,
    0,
  );
};

const deriveTemporalStatus = (medicationTime, now = new Date()) => {
  const reminderAt = parseMedicationTime(medicationTime, now);

  if (!reminderAt) {
    return "upcoming";
  }

  return now >= reminderAt ? "due" : "upcoming";
};

const getActionsByStatus = (status) => {
  if (status === "due") {
    return DUE_ACTIONS;
  }

  return [];
};

const mapMedicationResponse = (medication, status) => {
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
    status,
    actions: getActionsByStatus(status),
  };
};

const getTodayMedicationResponse = async (userId) => {
  if (!userId) {
    throw new CustomError("userId is required", [], 400);
  }

  const dayStart = getStartOfDay();
  const dayEndExclusive = getEndOfDayExclusive();

  const [medications, todayHistories] = await Promise.all([
    Medication.find({ userId, isActive: true }).sort({ createdAt: 1 }),
    MedicationHistory.find({
      userId,
      date: { $gte: dayStart, $lt: dayEndExclusive },
    })
      .select("medicationId status")
      .lean(),
  ]);

  const historyStatusByMedicationId = todayHistories.reduce(
    (accumulator, historyItem) => {
      const medicationId = String(historyItem.medicationId);
      if (!accumulator.has(medicationId)) {
        accumulator.set(medicationId, historyItem.status);
      }
      return accumulator;
    },
    new Map(),
  );

  return medications.map((medication) => {
    const historyStatus = historyStatusByMedicationId.get(
      String(medication._id),
    );
    const finalStatus = historyStatus || deriveTemporalStatus(medication.time);

    return mapMedicationResponse(medication, finalStatus);
  });
};

const updateMedicationStatusService = async ({
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
    userId,
    isActive: true,
  }).select("_id userId");

  if (!medication) {
    throw new CustomError("Medication not found", [], 404);
  }

  const now = new Date();
  const dayStart = getStartOfDay(now);

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
};
