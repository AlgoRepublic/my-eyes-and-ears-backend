const { asyncMiddleware } = require("../../../../middlewares/async");
const {
  getMemberMedicationsService,
  getParentTodayMedicationsService,
  createMemberMedicationService,
  updateMemberMedicationService,
  deleteMemberMedicationService,
} = require("../../../../services/user/memberMedications");

const getMemberMedications = asyncMiddleware(async (req, res, next) => {
  const data = await getMemberMedicationsService(req.user, req.params.userId);

  next({
    success: true,
    message: "Medications fetched successfully",
    statusCode: 200,
    data,
  });
});

const getParentTodayMedications = asyncMiddleware(async (req, res, next) => {
  const userId = req.query.userId || req.body?.userId;
  const data = await getParentTodayMedicationsService(req.user, userId);

  next({
    success: true,
    message: "Today's medications fetched successfully",
    statusCode: 200,
    data,
  });
});

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
  getParentTodayMedications,
  getMemberMedications,
  createMemberMedication,
  updateMemberMedication,
  deleteMemberMedication,
};
