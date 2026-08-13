const { asyncMiddleware } = require("../../../../middlewares/async");
const { remindParentService } = require("../../../../services/user/remindParent");

const remindParent = asyncMiddleware(async (req, res, next) => {
  const userId = req.params.userId || req.query.userId || req.body?.userId;
  const payload = {
    ...req.body,
    appointmentId:
      req.body?.appointmentId ||
      req.query?.appointmentId ||
      req.params?.appointmentId,
  };
  const data = await remindParentService(req.user, userId, payload);

  next({
    success: true,
    message: "Reminder sent to parent successfully",
    statusCode: 200,
    data,
  });
});

module.exports = remindParent;
