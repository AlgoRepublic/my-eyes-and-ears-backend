const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { CustomError } = require("../../utils/error");
const { joiValidate, joiFormatErrors } = require("../../utils/joi");
const { loginSchema } = require("../../utils/validation");
const User = require("../../models/user");
const bcrypt = require("bcrypt");

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

  if (!user.password) {
    console.log("LOGIN DEBUG: User has no password set");
    if (password && typeof password === "string") {
      const saltRounds = 10;
      user.password = await bcrypt.hash(password.trim(), saltRounds);
      await user.save();
    }

    throw new CustomError("Password not set for this user");
  }

  console.log("LOGIN DEBUG: Stored Hash:", user.password);
  console.log("LOGIN DEBUG: Input Password:", password);

  const isPasswordValid = await user.comparePassword(password);
  console.log("LOGIN DEBUG: Password Valid?", isPasswordValid);
  if (!isPasswordValid) {
    throw new CustomError("Invalid email or password");
  }

  const accessToken = jwt.sign(
    { userId: user.id, type: "access" },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1m",
    }
  );

  const refreshToken = crypto.randomBytes(64).toString("hex");

  return {
    success: true,
    statusCode: 200,
    message: "User logged in successfully",
    data: {
      user,
      accessToken,
      refreshToken,
    },
  };
};

module.exports = {
  loginService,
};
