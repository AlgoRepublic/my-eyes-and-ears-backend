const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  deleteProfileService,
} = require("../../../../services/user/deleteProfile");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await deleteProfileService(req.user.id);

  next({
    success: true,
    message: "Profile deleted successfully",
    statusCode: 200,
    data,
  });
});
