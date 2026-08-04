const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const Family = require("../../models/family");
const {
  getTodayMedicationResponse,
} = require("../medication/medicationHistory");
const {
  getDashboardAppointments,
} = require("../appointment/dashboardAppointments");
const { addFcmTokenToUser } = require("./fcmToken");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

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

const buildFamilyName = async (familyId) => {
  const family = await Family.findById(familyId);
  return family?.name || "";
};

const parentLoginService = async (invitationCode, role, fcmToken) => {
  const normalizedInvitationCode = String(invitationCode || "")
    .trim()
    .toUpperCase();
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim();

  if (!normalizedInvitationCode || !normalizedRole) {
    throw new CustomError("invitationCode and role are required", [], 400);
  }

  if (normalizedRole !== "parent") {
    throw new CustomError("Invalid role for invitation login", [], 403);
  }

  const parentUser = await User.findOne({
    familyInvitationCode: normalizedInvitationCode,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  });

  if (!parentUser) {
    throw new CustomError("Invalid invitation code", [], 404);
  }

  const hasUpdatedFcmToken = addFcmTokenToUser(parentUser, fcmToken);
  parentUser.isEmailVerified = true; // Mark email as verified upon successful login
  parentUser.isProfileCompleted = true; // Mark profile as completed upon successful login
  await parentUser.save();

  const [
    profileSetting,
    medications,
    contacts,
    checkinReminders,
    dashboardAppointments,
  ] = await Promise.all([
    ProfileSetting.findOne({ userId: parentUser._id }),
    getTodayMedicationResponse(parentUser._id),
    Contact.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    CheckinReminder.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
    getDashboardAppointments(parentUser._id),
  ]);

  const accessToken = signAccessToken(parentUser);
  const refreshToken = jwt.sign(
    { id: parentUser.id, type: "refresh" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
    },
  );
  const familyName = await buildFamilyName(parentUser.familyId);
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
    user: {
      id: parentUser._id,
      role: parentUser.role,
      name: parentUser.name,
      email: parentUser.email,
      familyName: familyName || "",
      phoneNumber: parentUser.phoneNumber,
      image: parentUser.image,
      relation: parentUser.relation,
      caregiverId: parentUser.caregiverId,
      familyInvitationCode: parentUser.familyInvitationCode,
      isProfileCompleted: parentUser.isProfileCompleted,
      hasPassword: Boolean(parentUser.password),
      createdAt: parentUser.createdAt,
      updatedAt: parentUser.updatedAt,
      accessibilities: profileSetting
        ? {
            id: profileSetting._id,
            userId: profileSetting.userId,
            fontSize: profileSetting.fontSize,
            highContrast: profileSetting.highContrast ?? false,
            voiceAssistance: profileSetting.voiceAssistance ?? false,
            hapticFeedback: profileSetting.hapticFeedback ?? false,
            voiceSpeed: profileSetting.voiceSpeed ?? 1,
            appLanguage: profileSetting.appLanguage ?? null,
            readingVoice: profileSetting.readingVoice ?? null,
            translationLanguage: profileSetting.translationLanguage ?? null,
            autoReadAfterScan: profileSetting.autoReadAfterScan ?? false,
            createdAt: profileSetting.createdAt,
            updatedAt: profileSetting.updatedAt,
          }
        : null,
      notificationConfig: profileSetting
        ? {
            dailyCheckInReminders: profileSetting.dailyCheckInReminders ?? true,
            medicationReminders: profileSetting.medicationReminders ?? true,
            appointmentsReminders: profileSetting.appointmentsReminders ?? true,
            familyMessages: profileSetting.familyMessages ?? true,
            doNotDisturb: profileSetting.doNotDisturb ?? false,
          }
        : null,
      privacyandDignity: profileSetting
        ? {
            shareCheckInStatus: profileSetting.shareCheckInStatus ?? true,
            shareMedication: profileSetting.shareMedication ?? true,
            shareLocation: profileSetting.shareLocation ?? true,
          }
        : null,
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
      // medicationDuesCount: medications.filter((med) => med.status === "due")
      //   .length,
      // medications,
      // contacts: contacts.map((item) => ({
      //   id: item._id,
      //   userId: item.userId,
      //   name: item.name,
      //   phoneNumber: item.phoneNumber,
      //   relationship: item.relationship,
      //   isPrimary: item.isPrimary,
      //   isActive: item.isActive,
      //   createdAt: item.createdAt,
      //   updatedAt: item.updatedAt,
      // })),
      // checkinReminders: checkinReminders.map((item) => ({
      //   id: item._id,
      //   userId: item.userId,
      //   time: item.time,
      //   label: item.label,
      //   isEnabled: item.isEnabled,
      //   createdAt: item.createdAt,
      //   updatedAt: item.updatedAt,
      // })),
      // upcomingAppointment: dashboardAppointments.upcomingAppointment,
      // appointments: dashboardAppointments.appointments,
      accessToken,
      refreshToken,
    },

    message: "Parent login successful",
  };
};

module.exports = {
  parentLoginService,
};
