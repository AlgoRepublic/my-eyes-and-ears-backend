const { asyncMiddleware } = require("../../../../middlewares/async");
const { parentLoginService } = require("../../../../services/auth/parentLogin");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { invitationCode, role } = { ...req.body, ...req.query };
  const data = await parentLoginService(invitationCode, role);

  next({
    success: true,
    message: data.message,
    statusCode: 200,
    data,
  });
});
