const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  getWeeklyDigestService,
} = require("../../../../services/user/weeklyDigest");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await getWeeklyDigestService(req.user, {
    memberId: req.query.memberId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });

  next({
    success: true,
    message: "Weekly digest fetched",
    statusCode: 200,
    data,
  });
});
