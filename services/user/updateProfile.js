const User = require("../../models/user");
const Family = require("../../models/family");
const ProfileSetting = require("../../models/profileSetting");
const { CustomError } = require("../../utils/error");
const {
  saveProfileImage,
  deleteStoredFile,
} = require("../../utils/fileStorage");
const {
  appendCaregiverNotificationSettings,
  extractNotificationSettingUpdates,
  getOrCreateCaregiverProfileSetting,
} = require("./caregiverNotificationSettings");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const normalizeOptionalString = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const parseBooleanLike = (value, fieldName) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }

  throw new CustomError(`${fieldName} must be a boolean`, [], 400);
};

const PARENT_SETTING_BOOLEAN_KEYS = [
  "highContrast",
  "voiceAssistance",
  "hapticFeedback",
  "autoReadAfterScan",
  "dailyCheckInReminders",
  "medicationReminders",
  "appointmentsReminders",
  "familyMessages",
  "doNotDisturb",
  "shareCheckInStatus",
  "shareMedication",
  "shareLocation",
];

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

const extractParentProfileSettingUpdates = (payload = {}) => {
  const accessibilities =
    payload.accessibilities && typeof payload.accessibilities === "object"
      ? payload.accessibilities
      : {};
  const notificationConfig =
    payload.notificationConfig && typeof payload.notificationConfig === "object"
      ? payload.notificationConfig
      : {};
  const privacyandDignity =
    payload.privacyandDignity && typeof payload.privacyandDignity === "object"
      ? payload.privacyandDignity
      : {};

  const source = {
    ...accessibilities,
    ...notificationConfig,
    ...privacyandDignity,
    ...payload,
  };

  const updates = {};

  if (source.fontSize !== undefined) {
    updates.fontSize = normalizeOptionalString(source.fontSize);
  }

  if (source.voiceSpeed !== undefined) {
    if (String(source.voiceSpeed).trim() === "") {
      throw new CustomError("voiceSpeed must be a valid number", [], 400);
    }

    const voiceSpeed = Number(source.voiceSpeed);
    if (!Number.isFinite(voiceSpeed)) {
      throw new CustomError("voiceSpeed must be a valid number", [], 400);
    }
    updates.voiceSpeed = voiceSpeed;
  }

  if (source.appLanguage !== undefined) {
    updates.appLanguage = normalizeOptionalString(source.appLanguage);
  }

  if (source.readingVoice !== undefined) {
    updates.readingVoice = normalizeOptionalString(source.readingVoice);
  }

  if (source.translationLanguage !== undefined) {
    updates.translationLanguage = normalizeOptionalString(
      source.translationLanguage,
    );
  }

  for (const key of PARENT_SETTING_BOOLEAN_KEYS) {
    if (source[key] !== undefined) {
      updates[key] = parseBooleanLike(source[key], key);
    }
  }

  return updates;
};

const getOrCreateProfileSetting = async (userId) => {
  let profileSetting = await ProfileSetting.findOne({ userId });

  if (!profileSetting) {
    profileSetting = await ProfileSetting.create({ userId });
  }

  return profileSetting;
};

const updateProfileService = async (userId, payload, files = []) => {
  const user = await User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  const { familyName, currentPassword, newPassword } = payload || {};
  const updates = {};
  const imageFile = Array.isArray(files)
    ? files.find((file) => file.fieldname === "image")
    : null;
  const previousImage = user.image;
  const notificationSettingUpdates =
    user.role === "caregiver" ? extractNotificationSettingUpdates(payload) : {};
  const parentProfileSettingUpdates =
    user.role === "parent" ? extractParentProfileSettingUpdates(payload) : {};

  if (payload?.name !== undefined) {
    const name = String(payload.name || "").trim();

    if (!name) {
      throw new CustomError("name is required", [], 400);
    }

    updates.name = name;
  }

  if (payload?.email !== undefined) {
    const email = String(payload.email || "")
      .toLowerCase()
      .trim();

    if (email) {
      const existingEmail = await User.findOne({
        _id: { $ne: user._id },
        email,
        ...ACTIVE_USER_FILTER,
      }).select("_id");

      if (existingEmail) {
        throw new CustomError("Email already exists", [], 400);
      }

      updates.email = email;
    } else {
      updates.email = null;
    }
  }

  if (payload?.phoneNumber !== undefined) {
    const phoneNumber = String(payload.phoneNumber || "").trim();

    if (phoneNumber) {
      const existingPhone = await User.findOne({
        _id: { $ne: user._id },
        phoneNumber,
        ...ACTIVE_USER_FILTER,
      }).select("_id");

      if (existingPhone) {
        throw new CustomError("Phone number already exists", [], 400);
      }

      updates.phoneNumber = phoneNumber;
    } else {
      updates.phoneNumber = null;
    }
  }

  if (familyName !== undefined) {
    updates.familyName = normalizeOptionalString(familyName) || "";
    // if user is caregiver and user is isPrimary is true, then set isProfileCompleted to true
    if (user.role === "caregiver" && user.isPrimary) {
      updates.isProfileCompleted = true;
      await Family.updateOne(
        { _id: user.familyId },
        { $set: { name: familyName } },
      );
    }
  }

  if (currentPassword !== undefined || newPassword !== undefined) {
    const normalizedCurrentPassword = String(currentPassword || "").trim();
    const normalizedNewPassword = String(newPassword || "").trim();
    const hasExistingPassword = Boolean(user.password);

    if (!normalizedNewPassword) {
      throw new CustomError("newPassword is required", [], 400);
    }

    if (hasExistingPassword && !normalizedCurrentPassword) {
      throw new CustomError("currentPassword is required", [], 400);
    }

    if (hasExistingPassword) {
      const isCurrentPasswordValid = await user.comparePassword(
        normalizedCurrentPassword,
      );

      if (!isCurrentPasswordValid) {
        throw new CustomError("Current password is incorrect", [], 400);
      }
    }

    updates.password = normalizedNewPassword;
  }

  if (imageFile) {
    updates.image = await saveProfileImage(imageFile, userId);
  }

  if (
    Object.keys(updates).length === 0 &&
    Object.keys(notificationSettingUpdates).length === 0 &&
    Object.keys(parentProfileSettingUpdates).length === 0
  ) {
    throw new CustomError("No valid profile fields provided", [], 400);
  }

  let profileSetting = null;

  if (Object.keys(notificationSettingUpdates).length > 0) {
    if (user.role !== "caregiver") {
      throw new CustomError(
        "Notification settings can only be updated for caregivers",
        [],
        403,
      );
    }

    profileSetting = await getOrCreateCaregiverProfileSetting(user._id);
    Object.assign(profileSetting, notificationSettingUpdates);
    await profileSetting.save();
  }

  if (Object.keys(parentProfileSettingUpdates).length > 0) {
    if (user.role !== "parent") {
      throw new CustomError(
        "These profile settings can only be updated for parents",
        [],
        403,
      );
    }

    profileSetting = await getOrCreateProfileSetting(user._id);
    Object.assign(profileSetting, parentProfileSettingUpdates);
    await profileSetting.save();
  }

  if (Object.keys(updates).length > 0) {
    Object.assign(user, updates);
    await user.save();
  }

  if (imageFile && previousImage) {
    await deleteStoredFile(previousImage);
  }

  const baseUserResponse = {
    id: user._id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    familyName: user.familyName,
    image: user.image,
    avatarColor: user.avatarColor,
    isEmailVerified: user.isEmailVerified,
    isProfileCompleted: user.isProfileCompleted,
    hasPassword: Boolean(user.password),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  let userResponse = await appendCaregiverNotificationSettings(
    user,
    baseUserResponse,
  );

  if (user.role === "parent") {
    const parentProfileSetting =
      profileSetting || (await ProfileSetting.findOne({ userId: user._id }));

    userResponse = {
      ...userResponse,
      ...buildParentProfileSettingResponse(parentProfileSetting),
    };
  }

  return {
    user: userResponse,
  };
};

module.exports = {
  updateProfileService,
};
