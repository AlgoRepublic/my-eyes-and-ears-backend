const TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_NO_TZ_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const parseTimeParts = (timeValue) => {
  if (!timeValue) return null;

  const raw = String(timeValue).trim();
  if (!raw) return null;

  const match = raw.match(TIME_PATTERN);
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

  return { hours, minutes };
};

const getUtcDateTimeForTodayTime = (timeValue, now = new Date()) => {
  const timeParts = parseTimeParts(timeValue);
  if (!timeParts) return null;

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      timeParts.hours,
      timeParts.minutes,
      0,
      0,
    ),
  );
};

const getUtcDateTimeFromStoredTime = (timeValue, now = new Date()) => {
  if (!timeValue) return null;

  const raw = String(timeValue).trim();
  if (!raw) return null;

  // New format: full UTC datetime string saved in the time field.
  if (/\d{4}-\d{2}-\d{2}T/i.test(raw)) {
    const parsedDate = parseDateInputToUtc(raw);
    return parsedDate || null;
  }

  // Legacy format: only HH:mm (with optional AM/PM), anchor to current UTC date.
  return getUtcDateTimeForTodayTime(raw, now);
};

const getUtcDateTimeForTodayCheckin = (timeValue, now = new Date()) => {
  if (!timeValue) return null;

  const raw = String(timeValue).trim();
  if (!raw) return null;

  if (/\d{4}-\d{2}-\d{2}T/i.test(raw)) {
    const parsedDate = parseDateInputToUtc(raw);
    if (!parsedDate) return null;

    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        parsedDate.getUTCHours(),
        parsedDate.getUTCMinutes(),
        parsedDate.getUTCSeconds(),
        parsedDate.getUTCMilliseconds(),
      ),
    );
  }

  return getUtcDateTimeForTodayTime(raw, now);
};

const getUtcDateTimeFromDateAndTime = (dateValue, timeValue) => {
  if (!dateValue) return null;

  const baseDate = new Date(dateValue);
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  let timeParts = parseTimeParts(timeValue);

  if (!timeParts && timeValue) {
    const parsedStoredTime = parseDateInputToUtc(timeValue);
    if (parsedStoredTime) {
      timeParts = {
        hours: parsedStoredTime.getUTCHours(),
        minutes: parsedStoredTime.getUTCMinutes(),
      };
    }
  }

  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const date = baseDate.getUTCDate();

  if (!timeParts) {
    return new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
  }

  return new Date(
    Date.UTC(year, month, date, timeParts.hours, timeParts.minutes, 0, 0),
  );
};

const getUtcStartOfDay = (inputDate = new Date()) => {
  const date = new Date(inputDate);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

const getUtcEndOfDayExclusive = (inputDate = new Date()) => {
  const dayStart = getUtcStartOfDay(inputDate);
  return new Date(
    Date.UTC(
      dayStart.getUTCFullYear(),
      dayStart.getUTCMonth(),
      dayStart.getUTCDate() + 1,
    ),
  );
};

const getUtcWeekDayName = (inputDate = new Date()) => {
  return inputDate
    .toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
    .toLowerCase();
};

const isSameUtcDay = (leftDate, rightDate) => {
  if (!leftDate || !rightDate) return false;

  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
};

const parseDateInputToUtc = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const dateOnlyMatch = raw.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);

    const parsedDate = new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== monthIndex ||
      parsedDate.getUTCDate() !== day
    ) {
      return null;
    }

    return parsedDate;
  }

  const dateTimeNoTzMatch = raw.match(DATE_TIME_NO_TZ_PATTERN);
  if (dateTimeNoTzMatch) {
    const year = Number(dateTimeNoTzMatch[1]);
    const monthIndex = Number(dateTimeNoTzMatch[2]) - 1;
    const day = Number(dateTimeNoTzMatch[3]);
    const hours = Number(dateTimeNoTzMatch[4]);
    const minutes = Number(dateTimeNoTzMatch[5]);
    const seconds = dateTimeNoTzMatch[6] ? Number(dateTimeNoTzMatch[6]) : 0;
    const milliseconds = dateTimeNoTzMatch[7]
      ? Number(dateTimeNoTzMatch[7].padEnd(3, "0"))
      : 0;

    const parsedDate = new Date(
      Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds),
    );

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== monthIndex ||
      parsedDate.getUTCDate() !== day ||
      parsedDate.getUTCHours() !== hours ||
      parsedDate.getUTCMinutes() !== minutes ||
      parsedDate.getUTCSeconds() !== seconds
    ) {
      return null;
    }

    return parsedDate;
  }

  const parsedDate = new Date(raw);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

module.exports = {
  parseTimeParts,
  getUtcDateTimeForTodayTime,
  getUtcDateTimeForTodayCheckin,
  getUtcDateTimeFromStoredTime,
  getUtcDateTimeFromDateAndTime,
  getUtcStartOfDay,
  getUtcEndOfDayExclusive,
  getUtcWeekDayName,
  isSameUtcDay,
  parseDateInputToUtc,
};
