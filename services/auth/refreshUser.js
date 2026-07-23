const jwt = require("jsonwebtoken");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const {
  appendCaregiverNotificationSettings,
} = require("../user/caregiverNotificationSettings");

const signAccessToken = (user) => {
  return jwt.sign({ id: user.id, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
  });
};

const signRefreshToken = (user) => {
  return jwt.sign({ id: user.id, type: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
  });
};

const buildUserResponse = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  return appendCaregiverNotificationSettings(user, {
    id: user._id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    image: user.image,
    familyName: user.familyName,
    isEmailVerified: user.isEmailVerified,
    isProfileCompleted: user.isProfileCompleted,
    isPrimary: user.role === "caregiver" ? Boolean(user.isPrimary) : false,
    hasPassword: Boolean(user.password),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  });
};

const refreshUserService = async (refreshToken) => {
  const normalizedRefreshToken = String(refreshToken || "").trim();

  if (!normalizedRefreshToken) {
    throw new CustomError("refreshToken is required", [], 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(normalizedRefreshToken, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new CustomError(
        "Refresh token expired. Please log in again.",
        [],
        401,
      );
    }
    throw new CustomError("Invalid refresh token", [], 401);
  }

  if (decoded.type !== "refresh") {
    throw new CustomError("Invalid refresh token", [], 401);
  }

  const userId = decoded.id || decoded.userId;
  if (!userId) {
    throw new CustomError("Invalid refresh token payload", [], 401);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new CustomError("User not found for refresh token", [], 404);
  }

  const userData = await buildUserResponse(user);

  return {
    success: true,
    statusCode: 200,
    message: "User fetched successfully",
    data: {
      user: userData,
    },
  };
};

module.exports = {
  refreshUserService,
};
