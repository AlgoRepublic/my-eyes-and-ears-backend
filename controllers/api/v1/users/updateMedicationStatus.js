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

  const data = await updateMedicationStatusService({
    userId: req.user.id,
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
