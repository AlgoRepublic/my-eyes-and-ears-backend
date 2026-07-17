const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  getMemberDetailService,
} = require("../../../../services/user/getMemberDetail");

module.exports = asyncMiddleware(async (req, res, next) => {
  const userId = req.params.userId || req.query.userId || req.body?.userId;
  const data = await getMemberDetailService(req.user, userId);

  next({
    success: true,
    message: "Member fetched successfully",
    statusCode: 200,
    data,
  });
});
