const { asyncMiddleware } = require("../../../../middlewares/async");
const { addCaregiverService } = require("../../../../services/user/addCaregiver");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await addCaregiverService(req.user, req.body);

  next({
    success: true,
    message: "Caregiver added successfully",
    statusCode: 200,
    data,
  });
});
