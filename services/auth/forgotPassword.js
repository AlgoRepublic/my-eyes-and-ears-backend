const crypto = require("crypto");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const { sendForgotPasswordOtpEmail } = require("../notification/email");
const { dispatchEmail } = require("../notification/emailDispatch");

const OTP_EXPIRY_MINUTES = 10;

const generateSixDigitOtp = () => {
  const otpNumber = crypto.randomInt(100000, 1000000);
  return String(otpNumber);
};

const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

const forgotPasswordService = async (email) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) {
    throw new CustomError("Email is required", [], 400);
  }

  const user = await User.findOne({
    email: normalizedEmail,
    ...ACTIVE_USER_FILTER,
  }).select("+forgotPasswordOtpHash +forgotPasswordOtpExpiresAt");

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }
  if (!user.password) {
    throw new CustomError(
      "Password reset is not allowed for social login users",
      [],
      400,
    );
  }

  const otp = generateSixDigitOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  user.emailVerificationOtpHash = hashOtp(otp);
  user.emailVerificationOtpExpiresAt = otpExpiresAt;
  await user.save();

  await dispatchEmail(
    () =>
      sendForgotPasswordOtpEmail({
        to: user.email,
        name: user.name,
        otp,
        expiresMinutes: OTP_EXPIRY_MINUTES,
      }),
    "forgot password OTP",
  );

  const reset = {
    otpExpiresAt,
    channel: "email",
  };

  if (process.env.NODE_ENV !== "production") {
    reset.otp = otp;
  }

  return {
    user: {
      id: user._id,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
    reset,
    message: "Password reset OTP sent successfully",
  };
};

module.exports = {
  forgotPasswordService,
};
