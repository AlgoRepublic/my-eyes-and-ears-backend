const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateMemberService,
} = require("../../../../services/user/updateMember");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await updateMemberService(
    req.user,
    req.params.userId,
    req.body,
    req.files,
  );

  next({
    success: true,
    message: "Member updated successfully",
    statusCode: 200,
    data,
  });
});
