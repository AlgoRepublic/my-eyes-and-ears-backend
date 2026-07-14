const { asyncMiddleware } = require("../../../../middlewares/async");
const { socialLoginService } = require("../../../../services/auth/socialLogin");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, idToken, source, role, fcmToken } = {
    ...req.body,
    ...req.query,
  };
  const data = await socialLoginService(email, idToken, source, role, fcmToken);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
