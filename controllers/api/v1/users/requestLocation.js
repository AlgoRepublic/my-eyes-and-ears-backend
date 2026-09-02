const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  requestMemberLocationService,
} = require("../../../../services/user/requestLocation");

module.exports = asyncMiddleware(async (req, res, next) => {
  const userId = req.params.userId || req.body?.userId || req.query?.userId;
  const data = await requestMemberLocationService(req.user, userId);

  next({
    success: true,
    message: "Location requested successfully",
    statusCode: 200,
    data,
  });
});
