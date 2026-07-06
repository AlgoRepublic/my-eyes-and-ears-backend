const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateProfileService,
} = require("../../../../services/user/updateProfile");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await updateProfileService(req.user.id, req.body, req.files);

  next({
    success: true,
    message: "Profile updated successfully",
    statusCode: 200,
    data,
  });
});
