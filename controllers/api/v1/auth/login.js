const { asyncMiddleware } = require("../../../../middlewares/async");
const { loginService } = require("../../../../services/auth/login");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { email, password } = { ...req.body, ...req.query };
  const data = await loginService(email, password);
  next(data);
});
