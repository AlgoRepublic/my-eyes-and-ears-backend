const { asyncMiddleware } = require("../../../../middlewares/async");
const { loginService } = require("../../../../services/auth/login");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, password, fcmToken } = { ...req.body, ...req.query };
  const data = await loginService(email, password, fcmToken);
  next(data);
});
