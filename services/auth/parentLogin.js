const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const Contact = require("../../models/contact");
const Family = require("../../models/family");
const { addFcmTokenToUser } = require("./fcmToken");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { buildParentRecentData } = require("../user/buildParentRecentData");
const { buildFamilyDetailsResponse } = require("../user/getFamilyDetails");
const {
  formatLocationResponse,
  resolveLocationStatus,
} = require("../../utils/location");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const buildFamilyName = async (familyId) => {
  const family = await Family.findById(familyId);
  return family?.name || "";
};

const formatLocationUpdatedAt = (location) => {
  if (!location?.updatedAt) {
    return null;
  }

  return new Date(location.updatedAt).toISOString();
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

  addFcmTokenToUser(parentUser, fcmToken);
  parentUser.isEmailVerified = true; // Mark email as verified upon successful login
  parentUser.isProfileCompleted = true; // Mark profile as completed upon successful login
  await parentUser.save();

  const [profileSetting, contacts, { recentData, medicationDuesCount }, family] =
    await Promise.all([
      ProfileSetting.findOne({ userId: parentUser._id }),
      Contact.find({ userId: parentUser._id }).sort({ createdAt: 1 }),
      buildParentRecentData(parentUser._id),
      parentUser.familyId
        ? buildFamilyDetailsResponse(parentUser, parentUser.familyId)
        : Promise.resolve(null),
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
  const location = formatLocationResponse(parentUser.location);

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
      location,
      location_updated_at: formatLocationUpdatedAt(parentUser.location),
      location_status: resolveLocationStatus(parentUser),
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
      recentData,
      medicationDuesCount,
      contacts: contacts.map((item) => ({
        id: item._id,
        userId: item.userId,
        name: item.name,
        phoneNumber: item.phoneNumber,
        relationship: item.relationship,
        isPrimary: item.isPrimary,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      family,
      accessToken,
      refreshToken,
    },

    message: "Parent login successful",
  };
};

module.exports = {
  parentLoginService,
};
