const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const Family = require("../../models/family");
const ProfileSetting = require("../../models/profileSetting");
const CheckinReminder = require("../../models/checkinReminder");
const { CustomError } = require("../../utils/error");
const {
  appendCaregiverNotificationSettings,
} = require("../user/caregiverNotificationSettings");
const {
  getTodayMedicationResponse,
} = require("../medication/medicationHistory");
const {
  getDashboardAppointments,
} = require("../appointment/dashboardAppointments");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const signRefreshToken = (user) => {
  return jwt.sign({ id: user.id, type: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
  });
};

const buildFamilyName = async (familyId) => {
  const family = await Family.findById(familyId);
  return family?.name || "";
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

const buildParentProfileSettingResponse = (profileSetting) => {
  if (!profileSetting) {
    return {
      accessibilities: null,
      notificationConfig: null,
      privacyandDignity: null,
    };
  }

  return {
    accessibilities: {
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
    },
    notificationConfig: {
      dailyCheckInReminders: profileSetting.dailyCheckInReminders ?? true,
      medicationReminders: profileSetting.medicationReminders ?? true,
      appointmentsReminders: profileSetting.appointmentsReminders ?? true,
      familyMessages: profileSetting.familyMessages ?? true,
      doNotDisturb: profileSetting.doNotDisturb ?? false,
    },
    privacyandDignity: {
      shareCheckInStatus: profileSetting.shareCheckInStatus ?? true,
      shareMedication: profileSetting.shareMedication ?? true,
      shareLocation: profileSetting.shareLocation ?? true,
    },
  };
};

const buildUserResponse = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const familyName = await buildFamilyName(user.familyId);

  const baseUser = {
    id: user._id,
    role: user.role,
    name: user.name,
    email: user.email,
    familyName: familyName || "",
    phoneNumber: user.phoneNumber,
    image: user.image,
    relation: user.relation,
    caregiverId: user.caregiverId,
    familyInvitationCode: user.familyInvitationCode,
    isEmailVerified: user.isEmailVerified,
    isProfileCompleted: user.isProfileCompleted,
    hasPassword: Boolean(user.password),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  };

  if (user.role === "parent") {
    const [profileSetting, parentRecentData] = await Promise.all([
      ProfileSetting.findOne({ userId: user._id }),
      buildParentRecentData(user._id),
    ]);

    return {
      ...baseUser,
      ...buildParentProfileSettingResponse(profileSetting),
      ...parentRecentData,
    };
  }

  return appendCaregiverNotificationSettings(user, {
    ...baseUser,
    isPrimary: user.role === "caregiver" ? Boolean(user.isPrimary) : false,
  });
};

const refreshUserService = async (refreshToken) => {
  const normalizedRefreshToken = String(refreshToken || "").trim();

  if (!normalizedRefreshToken) {
    throw new CustomError("refreshToken is required", [], 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(normalizedRefreshToken, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new CustomError(
        "Refresh token expired. Please log in again.",
        [],
        401,
      );
    }
    throw new CustomError("Invalid refresh token", [], 401);
  }

  if (decoded.type !== "refresh") {
    throw new CustomError("Invalid refresh token", [], 401);
  }

  const userId = decoded.id || decoded.userId;
  if (!userId) {
    throw new CustomError("Invalid refresh token payload", [], 401);
  }

  const user = await User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });
  if (!user) {
    throw new CustomError("User not found for refresh token", [], 404);
  }

  const userData = await buildUserResponse(user);

  return {
    success: true,
    statusCode: 200,
    message: "User fetched successfully",
    data: {
      user: userData,
    },
  };
};

module.exports = {
  refreshUserService,
};
