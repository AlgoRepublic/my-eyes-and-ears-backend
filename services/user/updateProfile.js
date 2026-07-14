const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const {
  saveProfileImage,
  deleteStoredFile,
} = require("../../utils/fileStorage");

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

  if (familyName !== undefined) {
    updates.familyName = String(familyName).trim();
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

  if (Object.keys(updates).length === 0) {
    throw new CustomError("No valid profile fields provided", [], 400);
  }

  Object.assign(user, updates);
  user.isProfileCompleted = Boolean(user.familyName);
  await user.save();

  if (imageFile && previousImage) {
    await deleteStoredFile(previousImage);
  }

  return {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      familyName: user.familyName,
      image: user.image,
      avatarColor: user.avatarColor,
      isEmailVerified: user.isEmailVerified,
      isProfileCompleted: user.isProfileCompleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
};

module.exports = {
  updateProfileService,
};
