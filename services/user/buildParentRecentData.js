const CheckinReminder = require("../../models/checkinReminder");
const {
  getTodayMedicationResponse,
} = require("../medication/medicationHistory");
const {
  getDashboardAppointments,
} = require("../appointment/dashboardAppointments");

const parseTimeParts = (timeValue) => {
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

  return { hours, minutes };
};

const getDateTimeForTodayTime = (timeValue, now = new Date()) => {
  const timeParts = parseTimeParts(timeValue);
  if (!timeParts) return null;

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  );
};

const getAppointmentDateTime = (appointment) => {
  if (!appointment?.date) return null;

  const baseDate = new Date(appointment.date);
  if (Number.isNaN(baseDate.getTime())) return null;

  const timeParts = parseTimeParts(appointment.time);
  if (!timeParts) {
    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    timeParts.hours,
    timeParts.minutes,
    0,
    0,
  );
};

const pickNearestUpcomingByTime = (
  items = [],
  timeAccessor,
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const item of items) {
    const dateTime = getDateTimeForTodayTime(timeAccessor(item), now);
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = item;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const pickNearestUpcomingAppointment = (
  appointments = [],
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const appointment of appointments) {
    if (appointment?.status && appointment.status !== "scheduled") {
      continue;
    }

    const dateTime = getAppointmentDateTime(appointment);
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = appointment;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const buildParentRecentData = async (userId) => {
  const [medications, checkinReminders, dashboardAppointments] =
    await Promise.all([
      getTodayMedicationResponse(userId),
      CheckinReminder.find({ userId }).sort({ createdAt: 1 }),
      getDashboardAppointments(userId),
    ]);

  const now = new Date();
  const upcomingMedication = pickNearestUpcomingByTime(
    medications,
    (medication) => medication?.time,
    now,
  );
  const upcomingCheckin = pickNearestUpcomingByTime(
    checkinReminders,
    (item) => item?.time,
    now,
  );
  const upcomingAppointment = pickNearestUpcomingAppointment(
    dashboardAppointments?.appointments || [],
    now,
  );

  return {
    recentData: {
      upcomingMedication: upcomingMedication
        ? {
            ...upcomingMedication,
            status: "due",
          }
        : null,
      upcomingCheckin,
      upcomingAppointment:
        upcomingAppointment ||
        dashboardAppointments?.upcomingAppointment ||
        null,
      sosStatus: null,
    },
    medicationDuesCount: medications.filter(
      (medication) => medication?.status !== "taken",
    ).length,
  };
};

module.exports = {
  buildParentRecentData,
};
