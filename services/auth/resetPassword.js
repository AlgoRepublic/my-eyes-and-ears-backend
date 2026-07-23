const crypto = require("crypto");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
};

const resetPasswordService = async (email, newPassword) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail || !newPassword) {
    throw new CustomError("Email and newPassword are required", [], 400);
  }

  const user = await User.findOne({
    email: normalizedEmail,
    ...ACTIVE_USER_FILTER,
  }).select("+forgotPasswordOtpHash +forgotPasswordOtpExpiresAt");

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  // if (!user.forgotPasswordOtpHash || !user.forgotPasswordOtpExpiresAt) {
  //   throw new CustomError("Reset OTP not requested", [], 400);
  // }

  // if (user.forgotPasswordOtpExpiresAt < new Date()) {
  //   throw new CustomError("OTP expired. Please request a new OTP", [], 400);
  // }

  // if (hashOtp(otp) !== user.forgotPasswordOtpHash) {
  //   throw new CustomError("Invalid OTP", [], 400);
  // }

  user.password = String(newPassword).trim();
  // user.forgotPasswordOtpHash = null;
  // user.forgotPasswordOtpExpiresAt = null;
  await user.save();

  return {
    user: {
      id: user._id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
    message: "Password reset successfully",
  };
};

module.exports = {
  resetPasswordService,
};
