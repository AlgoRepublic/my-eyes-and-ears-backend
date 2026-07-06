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

  const { familyName } = payload || {};
  const updates = {};
  const imageFile = Array.isArray(files)
    ? files.find((file) => file.fieldname === "image")
    : null;
  const previousImage = user.image;

  if (familyName !== undefined) {
    updates.familyName = String(familyName).trim();
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
