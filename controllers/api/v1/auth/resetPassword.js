const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  resetPasswordService,
} = require("../../../../services/auth/resetPassword");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, newPassword } = { ...req.body, ...req.query };
  const data = await resetPasswordService(email, newPassword);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
