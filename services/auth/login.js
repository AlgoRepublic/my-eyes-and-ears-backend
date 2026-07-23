const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { CustomError } = require("../../utils/error");
const { joiValidate, joiFormatErrors } = require("../../utils/joi");
const { loginSchema } = require("../../utils/validation");
const User = require("../../models/user");
const { addFcmTokenToUser } = require("./fcmToken");
const {
  appendCaregiverNotificationSettings,
} = require("../user/caregiverNotificationSettings");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const loginService = async (email, password, fcmToken) => {
  const { error } = await joiValidate(loginSchema, {
    email,
    password,
  });

  if (error) {
    throw new CustomError("Invalid params", joiFormatErrors(error));
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    ...ACTIVE_USER_FILTER,
  });

  if (!user) {
    console.log("LOGIN DEBUG: User not found", email);
    throw new CustomError("Invalid email or password");
  }

  // if (!user.isEmailVerified) {
  //   throw new CustomError(
  //     "Please verify your email with OTP before logging in",
  //     [],
  //     403,
  //   );
  // }

  if (!user.password) {
    throw new CustomError(
      "Password is not set for this account. Please login with social provider",
      [],
      400,
    );
  }

  console.log("LOGIN DEBUG: Stored Hash:", user.password);
  console.log("LOGIN DEBUG: Input Password:", password);

  const isPasswordValid = await user.comparePassword(password);
  console.log("LOGIN DEBUG: Password Valid?", isPasswordValid);
  if (!isPasswordValid) {
    throw new CustomError("Invalid email or password");
  }

  const hasUpdatedFcmToken = addFcmTokenToUser(user, fcmToken);
  if (hasUpdatedFcmToken) {
    await user.save();
  }

  const accessToken = jwt.sign(
    { id: user.id, type: "access" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
    },
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: "refresh" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "90d",
    },
  );

  const userData = await appendCaregiverNotificationSettings(user, {
    id: user._id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    familyName: user.familyName,
    image: user.image,
    isEmailVerified: user.isEmailVerified,
    isProfileCompleted: user.isProfileCompleted,
    isPrimary: user.role === "caregiver" ? Boolean(user.isPrimary) : false,
    hasPassword: Boolean(user.password),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
    refreshToken,
  });

  return {
    success: true,
    statusCode: 200,
    message: "User logged in successfully",
    data: {
      user: userData,
    },
  };
};

module.exports = {
  loginService,
};
