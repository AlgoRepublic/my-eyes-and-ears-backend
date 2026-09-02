const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateSosStatusService,
} = require("../../../../services/user/sosStatus");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await updateSosStatusService(req.user, req.body);

  next({
    success: true,
    message: "SOS status updated successfully",
    statusCode: 200,
    data,
  });
});
