const { asyncMiddleware } = require("../../../../middlewares/async");
const { logoutService } = require("../../../../services/auth/logout");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { fcmToken } = { ...req.body, ...req.query };
  const data = await logoutService(req.user?.id, fcmToken);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
