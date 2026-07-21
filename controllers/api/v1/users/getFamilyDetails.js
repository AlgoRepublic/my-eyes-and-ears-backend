const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  getFamilyDetailsService,
} = require("../../../../services/user/getFamilyDetails");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await getFamilyDetailsService(req.user);

  next({
    success: true,
    statusCode: 200,
    message: "Family fetched successfully.",
    data,
  });
});
