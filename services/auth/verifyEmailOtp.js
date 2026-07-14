const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { CustomError } = require("../../utils/error");
const User = require("../../models/user");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const signRefreshToken = () => {
  return crypto.randomBytes(64).toString("hex");
};

const verifyEmailOtpService = async (email, otp) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+emailVerificationOtpHash +emailVerificationOtpExpiresAt",
  );

  if (!user) {
    throw new CustomError("User not found", [], 404);
  }

  // if (user.isEmailVerified) {
  //   return {
  //     user: {
  //       id: user._id,
  //       email: user.email,
  //       name: user.name,
  //       phoneNumber: user.phoneNumber,
  //       isEmailVerified: user.isEmailVerified,
  //     },
  //     message: "Email is already verified",
  //   };
  // }
  if (process.env.NODE_ENV !== "production") {
    console.log("DEBUG: OTP validation skipped in non-production environment");
  } else {
    if (
      !user.emailVerificationOtpExpiresAt ||
      user.emailVerificationOtpExpiresAt < new Date()
    ) {
      throw new CustomError("OTP expired. Please request a new OTP", [], 400);
    }
    if (!user.isEmailOtpValid(otp)) {
      throw new CustomError("Invalid OTP", [], 400);
    }
  }

  user.isEmailVerified = true;
  user.emailVerificationOtpHash = null;
  user.emailVerificationOtpExpiresAt = null;
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = jwt.sign(
    { id: user.id, type: "refresh" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
    },
  );

  return {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      familyName: user.familyName,
      isEmailVerified: user.isEmailVerified,
      isProfileCompleted: user.isProfileCompleted,
      accessToken,
      refreshToken,
    },
    message: "OTP verified successfully.",
  };
};

module.exports = {
  verifyEmailOtpService,
};
