const { asyncMiddleware } = require("../../../../middlewares/async");
const { getMembersService } = require("../../../../services/user/getMembers");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await getMembersService(req.user);

  next({
    success: true,
    message: "Members fetched successfully",
    statusCode: 200,
    data,
  });
});
