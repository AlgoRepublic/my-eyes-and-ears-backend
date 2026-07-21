const User = require("../../models/user");
const ProfileSetting = require("../../models/profileSetting");
const { CustomError } = require("../../utils/error");
const {
  saveProfileImage,
  deleteStoredFile,
} = require("../../utils/fileStorage");
const { ensureParentMemberOrThrow } = require("./memberAccess");
const { getMemberDetailService } = require("./getMemberDetail");

const normalizeOptionalString = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const updateMemberService = async (
  currentUser,
  memberId,
  payload = {},
  files = [],
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const updates = {};
  const accessibilityPayload = payload.accessibilities || {};
  const imageFile = Array.isArray(files)
    ? files.find((file) => file.fieldname === "image")
    : null;
  const previousImage = parentUser.image;

  if (payload.role !== undefined && String(payload.role).trim() !== "parent") {
    throw new CustomError("Member role cannot be changed", [], 400);
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) {
      throw new CustomError("name is required", [], 400);
    }
    updates.name = name;
  }

  if (payload.email !== undefined) {
    const email = String(payload.email || "")
      .toLowerCase()
      .trim();
    if (email) {
      const existingEmail = await User.findOne({
        _id: { $ne: parentUser._id },
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

  if (payload.phoneNumber !== undefined) {
    const phoneNumber = String(payload.phoneNumber || "").trim();
    if (phoneNumber) {
      const existingPhone = await User.findOne({
        _id: { $ne: parentUser._id },
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

  if (payload.relation !== undefined) {
    updates.relation = normalizeOptionalString(payload.relation);
  }

  if (payload.avatarColor !== undefined) {
    updates.avatarColor = normalizeOptionalString(payload.avatarColor);
  }

  if (payload.location !== undefined) {
    updates.location = normalizeOptionalString(payload.location);
  }

  if (payload.familyName !== undefined) {
    updates.familyName = normalizeOptionalString(payload.familyName) || "";
  }

  if (payload.missedCheckInAlerts !== undefined) {
    updates.missedCheckInAlerts = Boolean(payload.missedCheckInAlerts);
  }

  const accessibilityUpdates = {};
  if (accessibilityPayload.fontSize !== undefined) {
    accessibilityUpdates.fontSize = normalizeOptionalString(
      accessibilityPayload.fontSize,
    );
  }

  if (accessibilityPayload.highContrast !== undefined) {
    accessibilityUpdates.highContrast = Boolean(
      accessibilityPayload.highContrast,
    );
  }

  if (accessibilityPayload.voiceAssistance !== undefined) {
    accessibilityUpdates.voiceAssistance = Boolean(
      accessibilityPayload.voiceAssistance,
    );
  }

  if (imageFile) {
    updates.image = await saveProfileImage(imageFile, parentUser._id);
  }

  if (
    Object.keys(updates).length === 0 &&
    Object.keys(accessibilityUpdates).length === 0
  ) {
    throw new CustomError("No valid member fields provided", [], 400);
  }

  Object.assign(parentUser, updates);
  // parentUser.isProfileCompleted = Boolean(parentUser.familyName);
  await parentUser.save();

  if (Object.keys(accessibilityUpdates).length > 0) {
    const profileSetting = await ProfileSetting.findOne({
      userId: parentUser._id,
    });

    if (profileSetting) {
      Object.assign(profileSetting, accessibilityUpdates);
      await profileSetting.save();
    } else {
      await ProfileSetting.create({
        userId: parentUser._id,
        ...accessibilityUpdates,
      });
    }
  }

  if (imageFile && previousImage) {
    await deleteStoredFile(previousImage);
  }

  return getMemberDetailService(currentUser, parentUser._id);
};

module.exports = {
  updateMemberService,
};
