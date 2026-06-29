const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  verifyEmailOtpService,
} = require("../../../../services/auth/verifyEmailOtp");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, otp } = { ...req.body, ...req.query };
  const data = await verifyEmailOtpService(email, otp);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
