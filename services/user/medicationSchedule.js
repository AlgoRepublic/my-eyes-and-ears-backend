const { CustomError } = require("../../utils/error");

const MEDICATION_FREQUENCIES = ["daily", "weekly", "custom_dates"];
const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const normalizeFrequency = (frequency) => {
  const normalized = String(frequency || "")
    .trim()
    .toLowerCase();

  if (!MEDICATION_FREQUENCIES.includes(normalized)) {
    throw new CustomError(
      "frequency must be one of daily, weekly, custom_dates",
      [],
      400,
    );
  }

  return normalized;
};

const normalizeDays = (days) => {
  if (!Array.isArray(days)) {
    throw new CustomError("days must be an array", [], 400);
  }

  const normalized = [
    ...new Set(
      days
        .map((item) =>
          String(item || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ];

  if (normalized.length === 0) {
    throw new CustomError("days is required when frequency is weekly", [], 400);
  }

  const invalidDay = normalized.find((item) => !WEEK_DAYS.includes(item));
  if (invalidDay) {
    throw new CustomError(
      `Invalid day: ${invalidDay}. Use monday to sunday`,
      [],
      400,
    );
  }

  return normalized;
};

const normalizeDates = (dates) => {
  if (!Array.isArray(dates)) {
    throw new CustomError("dates must be an array", [], 400);
  }

  const parsed = dates.map((item) => {
    const date = new Date(item);
    if (Number.isNaN(date.getTime())) {
      throw new CustomError("All dates must be valid date values", [], 400);
    }

    return date;
  });

  if (parsed.length === 0) {
    throw new CustomError(
      "dates is required when frequency is custom_dates",
      [],
      400,
    );
  }

  return parsed;
};

const buildMedicationSchedule = ({ frequency, days, dates }) => {
  const normalizedFrequency = normalizeFrequency(frequency);

  if (normalizedFrequency === "weekly") {
    return {
      frequency: normalizedFrequency,
      days: normalizeDays(days),
      dates: [],
    };
  }

  if (normalizedFrequency === "custom_dates") {
    return {
      frequency: normalizedFrequency,
      days: [],
      dates: normalizeDates(dates),
    };
  }

  return {
    frequency: normalizedFrequency,
    days: [],
    dates: [],
  };
};

module.exports = {
  MEDICATION_FREQUENCIES,
  WEEK_DAYS,
  buildMedicationSchedule,
};
