const { asyncMiddleware } = require("../../../../middlewares/async");
const { signupService } = require("../../../../services/auth/signup");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, password, name, phoneNumber, role } = {
    ...req.body,
    ...req.query,
  };
  const user = await signupService(email, password, name, phoneNumber, role);
  next({
    success: true,
    message: "User registered successfully",
    statusCode: 201,
    data: user,
  });
});
