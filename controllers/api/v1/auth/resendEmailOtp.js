const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  resendEmailOtpService,
} = require("../../../../services/auth/resendEmailOtp");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email } = { ...req.body, ...req.query };
  const data = await resendEmailOtpService(email);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
