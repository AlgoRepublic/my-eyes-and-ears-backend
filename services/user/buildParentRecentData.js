const {
  getTodayMedicationResponse,
  pickNearestUpcomingMedication,
} = require("../medication/medicationHistory");
const {
  getTodayCheckinResponse,
  buildCheckinSummary,
} = require("../checkin/checkinHistory");
const {
  getDashboardAppointments,
} = require("../appointment/dashboardAppointments");
const { getUtcDateTimeFromDateAndTime } = require("../../utils/utcDateTime");

const pickNearestUpcomingAppointment = (
  appointments = [],
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const appointment of appointments) {
    if (
      appointment?.status === "completed" ||
      appointment?.status === "cancelled"
    ) {
      continue;
    }

    const dateTime = getUtcDateTimeFromDateAndTime(
      appointment?.date,
      appointment?.time,
    );
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = appointment;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const buildParentRecentData = async (userId) => {
  const [medications, todayCheckins, dashboardAppointments] = await Promise.all([
    getTodayMedicationResponse(userId),
    getTodayCheckinResponse(userId),
    getDashboardAppointments(userId),
  ]);

  const now = new Date();
  const upcomingMedication = pickNearestUpcomingMedication(medications, now);
  const checkinSummary = buildCheckinSummary(todayCheckins, now);
  const upcomingAppointment = pickNearestUpcomingAppointment(
    dashboardAppointments?.appointments || [],
    now,
  );

  return {
    recentData: {
      upcomingMedication: upcomingMedication || null,
      upcomingCheckin: checkinSummary.upcomingCheckin,
      nearestPassedCheckin: checkinSummary.nearestPassedCheckin,
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
