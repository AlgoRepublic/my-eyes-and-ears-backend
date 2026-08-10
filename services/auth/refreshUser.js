const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const Family = require("../../models/family");
const ProfileSetting = require("../../models/profileSetting");
const { CustomError } = require("../../utils/error");
const {
  appendCaregiverNotificationSettings,
} = require("../user/caregiverNotificationSettings");
const { buildParentRecentData } = require("../user/buildParentRecentData");
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
