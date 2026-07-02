const User = require("../../models/user");
const { CustomError } = require("../../utils/error");

const updateProfileService = async (userId, payload) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  const { familyName } = payload || {};
  const updates = {};

  if (familyName !== undefined) {
    updates.familyName = String(familyName).trim();
  }

  if (Object.keys(updates).length === 0) {
    throw new CustomError("No valid profile fields provided", [], 400);
  }

  Object.assign(user, updates);
  user.isProfileCompleted = Boolean(user.familyName);
  await user.save();

  return {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      familyName: user.familyName,
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
