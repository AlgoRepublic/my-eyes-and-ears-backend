const { CustomError } = require("../../utils/error");
const User = require("../../models/user");
const Family = require("../../models/family");
const ProfileSetting = require("../../models/profileSetting");
const Medication = require("../../models/medication");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Appointment = require("../../models/appointment");
const { buildMemberResponse } = require("./addMember");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const {
  getUtcDateTimeFromStoredTime,
  getUtcStartOfDay,
} = require("../../utils/utcDateTime");
const {
  formatUpcomingAppointments,
} = require("../appointment/upcomingAppointments");

const buildFamilyName = async (familyId) => {
  if (!familyId) {
    return "";
  }

  const family = await Family.findById(familyId).select("name");
  return family?.name || "";
};

const pickNearestUpcomingByTime = (
  items = [],
  timeAccessor,
  now = new Date(),
) => {
  let nearest = null;
  let nearestDateTime = null;

  for (const item of items) {
    const dateTime = getUtcDateTimeFromStoredTime(timeAccessor(item), now);
    if (!dateTime || dateTime <= now) continue;

    if (!nearestDateTime || dateTime < nearestDateTime) {
      nearest = item;
      nearestDateTime = dateTime;
    }
  }

  return nearest;
};

const mapMemberAppointments = (appointments = []) =>
  appointments.map(
    ({
      id,
      userId,
      doctorName,
      reason,
      date,
      time,
      location,
      clinicPhone,
      note,
      rider,
      status,
    }) => ({
      id,
      userId,
      doctorName,
      reason,
      date,
      time,
      location,
      clinicPhone,
      note,
      rider,
      status,
    }),
  );

const getMemberDetailService = async (currentUser, userId) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    throw new CustomError("userId is required", [], 400);
  }

  const parentUser = await User.findOne({
    _id: normalizedUserId,
    familyId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  });

  if (!parentUser) {
    throw new CustomError("Parent member not found", [], 404);
  }

  const now = new Date();
  const todayStart = getUtcStartOfDay(now);

  const [
    profileSetting,
    medications,
    contacts,
    checkinReminders,
    appointments,
  ] = await Promise.all([
    ProfileSetting.findOne({ userId: parentUser._id }),
    Medication.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    Contact.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    CheckinReminder.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    Appointment.find({
      userId: parentUser._id,
      status: { $nin: ["completed", "cancelled"] },
      date: { $gte: todayStart },
    }).sort({ createdAt: 1 }),
  ]);

  const upcomingAppointments = formatUpcomingAppointments(appointments, now);

  const familyName = await buildFamilyName(familyId);
  const memberResponse = buildMemberResponse({
    parentUser,
    familyName,
    profileSetting,
    medications,
    contacts,
    checkinReminders,
    appointments: [],
  });

  const member = {
    ...memberResponse,
    appointments: mapMemberAppointments(upcomingAppointments),
    recentData: {
      upcomingMedication: (() => {
        const item = pickNearestUpcomingByTime(
          memberResponse.medications,
          (medication) => medication.time,
          now,
        );
        return item ? { ...item, status: "due" } : null;
      })(),
      upcomingCheckin: pickNearestUpcomingByTime(
        memberResponse.checkinReminders,
        (item) => item.time,
        now,
      ),
      upcomingAppointment: upcomingAppointments[0] || null,
      sosStatus: null,
    },
  };

  if (!member) {
    throw new CustomError("Member not found", [], 404);
  }

  return {
    member,
  };
};

module.exports = {
  getMemberDetailService,
};
