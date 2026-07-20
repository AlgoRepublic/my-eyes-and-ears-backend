const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  createMemberMedicationService,
  updateMemberMedicationService,
  deleteMemberMedicationService,
} = require("../../../../services/user/memberMedications");

const createMemberMedication = asyncMiddleware(async (req, res, next) => {
  const data = await createMemberMedicationService(
    req.user,
    req.params.userId,
    req.body,
  );

  next({
    success: true,
    message: "Medication created successfully",
    statusCode: 200,
    data,
  });
});

const updateMemberMedication = asyncMiddleware(async (req, res, next) => {
  const data = await updateMemberMedicationService(
    req.user,
    req.params.userId,
    req.params.medicationId,
    req.body,
  );

  next({
    success: true,
    message: "Medication updated successfully",
    statusCode: 200,
    data,
  });
});

const deleteMemberMedication = asyncMiddleware(async (req, res, next) => {
  const data = await deleteMemberMedicationService(
    req.user,
    req.params.userId,
    req.params.medicationId,
  );

  next({
    success: true,
    message: "Medication deleted successfully",
    statusCode: 200,
    data,
  });
});

module.exports = {
  createMemberMedication,
  updateMemberMedication,
  deleteMemberMedication,
};
