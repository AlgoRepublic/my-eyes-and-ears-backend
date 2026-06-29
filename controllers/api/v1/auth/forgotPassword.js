const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  forgotPasswordService,
} = require("../../../../services/auth/forgotPassword");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email } = { ...req.body, ...req.query };
  const data = await forgotPasswordService(email);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
