const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");

const ALLOWED_SOCIAL_SOURCES = ["google", "facebook", "apple"];

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const socialLoginService = async (email, idToken, source) => {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();
  const normalizedSource = String(source || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail || !idToken || !normalizedSource) {
    throw new CustomError("email, idToken and source are required", [], 400);
  }

  if (!ALLOWED_SOCIAL_SOURCES.includes(normalizedSource)) {
    throw new CustomError("Invalid source", [], 400);
  }

  const socialIdToken = String(idToken).trim();
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const generatedName = normalizedEmail.split("@")[0] || "social-user";
    const generatedPhoneNumber =
      `social-${normalizedSource}-${Date.now()}-${crypto
        .randomInt(1000, 10000)
        .toString()}`.toLowerCase();

    user = await User.create({
      email: normalizedEmail,
      password: null,
      name: generatedName,
      phoneNumber: "",
      isEmailVerified: true,
      emailVerificationOtpHash: null,
      emailVerificationOtpExpiresAt: null,
      socialAccounts: [
        {
          source: normalizedSource,
          idToken: socialIdToken,
          linkedAt: new Date(),
        },
      ],
    });
  } else {
    const existingIndex = (user.socialAccounts || []).findIndex(
      (account) => account.source === normalizedSource,
    );

    if (existingIndex >= 0) {
      user.socialAccounts[existingIndex].idToken = socialIdToken;
      user.socialAccounts[existingIndex].linkedAt = new Date();
    } else {
      user.socialAccounts = user.socialAccounts || [];
      user.socialAccounts.push({
        source: normalizedSource,
        idToken: socialIdToken,
        linkedAt: new Date(),
      });
    }

    user.isEmailVerified = true;
    await user.save();
  }

  const accessToken = signAccessToken(user);

  return {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      familyName: user.familyName,
      isEmailVerified: user.isEmailVerified,
      isProfileCompleted: user.isProfileCompleted,
      socialAccounts: (user.socialAccounts || []).map((account) => ({
        source: account.source,
        linkedAt: account.linkedAt,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accessToken,
    message: "Social login successful",
  };
};

module.exports = {
  socialLoginService,
};
