const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  deleteMemberService,
} = require("../../../../services/user/deleteMember");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await deleteMemberService(req.user, req.params.userId);

  next({
    success: true,
    message: "Member deleted successfully",
    statusCode: 200,
    data,
  });
});
