const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { removeFcmTokenFromUser } = require("./fcmToken");

const logoutService = async (userId, fcmToken) => {
  if (!userId) {
    throw new CustomError("Authenticated user is required", [], 401);
  }

  if (!String(fcmToken || "").trim()) {
    throw new CustomError("fcmToken is required", [], 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  const removed = removeFcmTokenFromUser(user, fcmToken);
  if (removed) {
    await user.save();
  }

  return {
    userId: user._id,
    removed,
    fcmTokens: user.fcmTokens || [],
    message: "Logout successful",
  };
};

module.exports = {
  logoutService,
};
