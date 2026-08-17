const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateCheckinStatusService,
} = require("../../../../services/checkin/checkinHistory");

module.exports = asyncMiddleware(async (req, res, next) => {
  const checkinId =
    req.params.checkinId || req.body?.checkinId || req.query?.checkinId;
  const status = req.body?.status || req.query?.status;
  const remindAt = req.body?.remindAt || req.query?.remindAt;
  const userId = req.query.userId || req.body?.userId;

  const data = await updateCheckinStatusService({
    currentUser: req.user,
    userId,
    checkinId,
    status,
    remindAt,
  });

  next({
    success: true,
    message: "Checkin status updated successfully",
    statusCode: 200,
    data,
  });
});
