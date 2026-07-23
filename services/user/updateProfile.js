const User = require("../../models/user");
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

const normalizeOptionalString = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const updateProfileService = async (userId, payload, files = []) => {
  const user = await User.findById(userId);

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
    user.role === "caregiver"
      ? extractNotificationSettingUpdates(payload)
      : {};

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
    Object.keys(notificationSettingUpdates).length === 0
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

  if (Object.keys(updates).length > 0) {
    Object.assign(user, updates);
    await user.save();
  }

  if (imageFile && previousImage) {
    await deleteStoredFile(previousImage);
  }

  const userResponse = await appendCaregiverNotificationSettings(user, {
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
  });

  return {
    user: userResponse,
  };
};

module.exports = {
  updateProfileService,
};
