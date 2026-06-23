const bcrypt = require("bcrypt");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");

/**
 * Service to handle user registration.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's plain text password.
 * @param {string} name - The user's full name.
 * @returns {Promise<Object>} The created user object.
 */
const signupService = async (email, password, name) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new CustomError("User already exists", 400);
  }

  const user = await User.create({
    email: email.toLowerCase(),
    password: password,
    name,
  });

  return user;
};

module.exports = {
  signupService,
};
