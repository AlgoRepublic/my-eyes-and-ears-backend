const crypto = require("crypto");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");

const OTP_EXPIRY_MINUTES = 10;

const generateSixDigitOtp = () => {
  const otpNumber = crypto.randomInt(100000, 1000000);
  return String(otpNumber);
};

const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

const resendEmailOtpService = async (email) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+emailVerificationOtpHash +emailVerificationOtpExpiresAt",
  );

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  if (user.isEmailVerified) {
    throw new CustomError("Email is already verified", [], 400);
  }

  const otp = generateSixDigitOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  user.emailVerificationOtpHash = hashOtp(otp);
  user.emailVerificationOtpExpiresAt = otpExpiresAt;
  await user.save();

  const verification = {
    otpExpiresAt,
    channel: "email",
  };

  if (process.env.NODE_ENV !== "production") {
    verification.otp = otp;
  }

  return {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      isEmailVerified: user.isEmailVerified,
    },
    verification,
    message: "OTP resent successfully",
  };
};

module.exports = {
  resendEmailOtpService,
};
