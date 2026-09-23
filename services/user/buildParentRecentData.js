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
const User = require("../../models/user");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

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
  const [medications, todayCheckins, dashboardAppointments, parentUser] =
    await Promise.all([
      getTodayMedicationResponse(userId),
      getTodayCheckinResponse(userId),
      getDashboardAppointments(userId),
      User.findOne({
        _id: userId,
        ...ACTIVE_USER_FILTER,
      }).select("sosStatus"),
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
      sosStatus: parentUser?.sosStatus || null,
    },
    medicationDuesCount: medications.filter(
      (medication) => medication?.status !== "taken",
    ).length,
  };
};

module.exports = {
  buildParentRecentData,
};
