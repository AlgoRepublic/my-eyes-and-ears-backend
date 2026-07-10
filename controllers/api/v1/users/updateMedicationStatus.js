const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  updateMedicationStatusService,
} = require("../../../../services/medication/medicationHistory");

module.exports = asyncMiddleware(async (req, res, next) => {
  const { medicationId, status, remindAt } = { ...req.body, ...req.query };

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
