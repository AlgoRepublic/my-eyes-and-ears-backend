const { asyncMiddleware } = require("../../../../middlewares/async");
const { refreshUserService } = require("../../../../services/auth/refreshUser");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { refreshToken } = { ...req.body, ...req.query };
  const data = await refreshUserService(refreshToken);
  next(data);
});
