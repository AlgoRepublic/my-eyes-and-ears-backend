const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  deleteCaregiverService,
} = require("../../../../services/user/deleteCaregiver");

module.exports = asyncMiddleware(async (req, res, next) => {
  const data = await deleteCaregiverService(req.user, req.params.userId);

  next({
    success: true,
    message: "Caregiver deleted successfully",
    statusCode: 200,
    data,
  });
});
