const { asyncMiddleware } = require("../../../../middlewares/async");
const { socialLoginService } = require("../../../../services/auth/socialLogin");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, idToken, source } = { ...req.body, ...req.query };
  const data = await socialLoginService(email, idToken, source);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
