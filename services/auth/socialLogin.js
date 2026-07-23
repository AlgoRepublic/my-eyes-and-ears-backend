const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { saveProfileImage } = require("../../utils/fileStorage");
const { addFcmTokenToUser, normalizeFcmToken } = require("./fcmToken");
const {
  appendCaregiverNotificationSettings,
} = require("../user/caregiverNotificationSettings");

const ALLOWED_SOCIAL_SOURCES = ["google", "facebook", "apple"];

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const downloadImageToProfileFile = async (imageUrl, userId) => {
  if (!imageUrl) {
    return null;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch (error) {
    throw new CustomError("Invalid image URL", [], 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new CustomError("Invalid image URL", [], 400);
  }

  let response;
  try {
    response = await fetch(parsedUrl.toString());
  } catch (error) {
    throw new CustomError("Unable to download social login image", [], 400);
  }

  if (!response.ok) {
    throw new CustomError("Unable to download social login image", [], 400);
  }

  const contentType = response.headers.get("content-type") || "";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return saveProfileImage(
    {
      buffer,
      mimetype: contentType,
      size: buffer.length,
    },
    userId,
  );
};

const socialLoginService = async (
  email,
  idToken,
  source,
  role,
  fcmToken,
  name,
  image,
) => {
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
  const normalizedFcmToken = normalizeFcmToken(fcmToken);
  const providedName = String(name || "").trim();
  const providedImageUrl = String(image || "").trim();
  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const generatedName =
      providedName || normalizedEmail.split("@")[0] || "social-user";

    user = await User.create({
      email: normalizedEmail,
      password: null,
      name: generatedName,
      phoneNumber: null,
      image: null,
      isEmailVerified: true,
      emailVerificationOtpHash: null,
      emailVerificationOtpExpiresAt: null,
      role,
      fcmTokens: normalizedFcmToken ? [normalizedFcmToken] : [],
      socialAccounts: [
        {
          source: normalizedSource,
          idToken: socialIdToken,
          linkedAt: new Date(),
        },
      ],
    });

    if (!user.image && providedImageUrl) {
      user.image = await downloadImageToProfileFile(providedImageUrl, user._id);
      await user.save();
    }
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
    if (providedName) {
      user.name = providedName;
    }
    if (!user.image && providedImageUrl) {
      user.image = await downloadImageToProfileFile(providedImageUrl, user._id);
    }
    addFcmTokenToUser(user, normalizedFcmToken);
    await user.save();
  }

  const accessToken = signAccessToken(user);
  const refreshToken = jwt.sign(
    { id: user.id, type: "refresh" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
    },
  );

  const userResponse = await appendCaregiverNotificationSettings(user, {
    id: user._id,
    email: user.email,
    name: user.name,
    image: user.image,
    phoneNumber: user.phoneNumber,
    familyName: user.familyName,
    isEmailVerified: user.isEmailVerified,
    isProfileCompleted: user.isProfileCompleted,
    isPrimary: user.role === "caregiver" ? Boolean(user.isPrimary) : false,
    hasPassword: Boolean(user.password),
    socialAccounts: (user.socialAccounts || []).map((account) => ({
      source: account.source,
      linkedAt: account.linkedAt,
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  });

  return {
    user: userResponse,
    message: "Social login successful",
  };
};

module.exports = {
  socialLoginService,
};
