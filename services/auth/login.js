const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { CustomError } = require("../../utils/error");
const { joiValidate, joiFormatErrors } = require("../../utils/joi");
const { loginSchema } = require("../../utils/validation");
const User = require("../../models/user");

const loginService = async (email, password) => {
  const { error } = await joiValidate(loginSchema, {
    email,
    password,
  });

  if (error) {
    throw new CustomError("Invalid params", joiFormatErrors(error));
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
  });

  if (!user) {
    console.log("LOGIN DEBUG: User not found", email);
    throw new CustomError("Invalid email or password");
  }

  if (!user.isEmailVerified) {
    throw new CustomError(
      "Please verify your email with OTP before logging in",
      [],
      403,
    );
  }

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

  const accessToken = jwt.sign(
    { id: user.id, type: "access" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
    },
  );

  const refreshToken = crypto.randomBytes(64).toString("hex");

  const userData = {
    id: user._id,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber,
    familyName: user.familyName,
    isEmailVerified: user.isEmailVerified,
    isProfileCompleted: user.isProfileCompleted,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    accessToken,
  };

  return {
    success: true,
    statusCode: 200,
    message: "User logged in successfully",
    data: {
      user: userData,
      // accessToken,
      // refreshToken,
    },
  };
};

module.exports = {
  loginService,
};
