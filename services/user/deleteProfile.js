const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const {
  ACTIVE_USER_FILTER,
  softDeleteUser,
} = require("../../utils/userSoftDelete");

const deleteProfileService = async (userId) => {
  const user = await User.findOne({
    _id: userId,
    ...ACTIVE_USER_FILTER,
  });

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  await softDeleteUser(user);

  return {
    deletedUserId: String(user._id),
  };
};

module.exports = {
  deleteProfileService,
};
