const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateMedicationStatusService,
} = require("../../../../services/medication/medicationHistory");

module.exports = asyncMiddleware(async (req, res, next) => {
  const medicationId =
    req.params.medicationId ||
    req.body?.medicationId ||
    req.query?.medicationId;
  const status = req.body?.status || req.query?.status;
  const remindAt = req.body?.remindAt || req.query?.remindAt;
  const userId = req.query.userId || req.body?.userId;

  const data = await updateMedicationStatusService({
    currentUser: req.user,
    userId,
    medicationId,
    status,
    remindAt,
  });

  next({
    success: true,
    message: "Medication status updated successfully",
    statusCode: 200,
    data,
  });
});
