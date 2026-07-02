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

/**
 * Service to handle user registration.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's plain text password.
 * @param {string} name - The user's full name.
 * @param {string} phoneNumber - The user's phone number.
 * @returns {Promise<Object>} The created user object.
 */
const signupService = async (email, password, name, phoneNumber) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new CustomError("User already exists", 400);
  }

  const otp = generateSixDigitOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const user = await User.create({
    email: normalizedEmail,
    password: password,
    name,
    phoneNumber: phoneNumber.toLowerCase(),
    isEmailVerified: false,
    emailVerificationOtpHash: hashOtp(otp),
    emailVerificationOtpExpiresAt: otpExpiresAt,
  });

  const userData = {
    id: user._id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  const verification = {
    otpExpiresAt,
    channel: "email",
  };

  if (process.env.NODE_ENV !== "production") {
    verification.otp = otp;
  }

  return {
    user: userData,
    verification,
  };
};

module.exports = {
  signupService,
};
