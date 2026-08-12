const { CustomError } = require("../../utils/error");

const MEDICATION_FREQUENCIES = ["once", "daily", "weekly", "custom_dates"];
const DATE_BASED_FREQUENCIES = ["once", "custom_dates"];
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
      "frequency must be one of once, daily, weekly, custom_dates",
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

const normalizeDateArray = (values, { fieldName, frequency }) => {
  if (!Array.isArray(values)) {
    throw new CustomError(`${fieldName} must be an array`, [], 400);
  }

  const parsed = values.map((item) => {
    const date = new Date(item);
    if (Number.isNaN(date.getTime())) {
      throw new CustomError(
        `All ${fieldName} values must be valid date values`,
        [],
        400,
      );
    }

    return date;
  });

  if (parsed.length === 0) {
    throw new CustomError(
      `${fieldName} is required when frequency is ${frequency}`,
      [],
      400,
    );
  }

  if (frequency === "once" && parsed.length !== 1) {
    throw new CustomError(
      "dates must contain exactly one date when frequency is once",
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

  if (DATE_BASED_FREQUENCIES.includes(normalizedFrequency)) {
    return {
      frequency: normalizedFrequency,
      days: [],
      dates: normalizeDateArray(dates, {
        fieldName: "dates",
        frequency: normalizedFrequency,
      }),
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
  DATE_BASED_FREQUENCIES,
  WEEK_DAYS,
  buildMedicationSchedule,
};
