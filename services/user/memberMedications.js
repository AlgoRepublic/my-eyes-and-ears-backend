const Medication = require("../../models/medication");
const MedicationHistory = require("../../models/medicationHistory");
const { CustomError } = require("../../utils/error");
const {
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
} = require("./memberAccess");

const mapMedication = (item) => ({
  id: item._id,
  userId: item.userId,
  name: item.name,
  dosage: item.dosage,
  frequency: item.frequency,
  startDate: item.startDate,
  endDate: item.endDate,
  notes: item.notes,
  time: item.time,
});

const toDateOrNull = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new CustomError(`${fieldName} must be a valid date`, [], 400);
  }

  return parsedDate;
};

const createMemberMedicationService = async (
  currentUser,
  memberId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const name = String(payload.name || "").trim();

  if (!name) {
    throw new CustomError("name is required", [], 400);
  }

  const medication = await Medication.create({
    userId: parentUser._id,
    name,
    dosage: payload.dosage ? String(payload.dosage).trim() : null,
    frequency: payload.frequency ? String(payload.frequency).trim() : null,
    startDate: toDateOrNull(payload.startDate, "startDate"),
    endDate: toDateOrNull(payload.endDate, "endDate"),
    notes: payload.notes ? String(payload.notes).trim() : null,
    time: payload.time ? String(payload.time).trim() : null,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
  });

  return {
    medication: mapMedication(medication),
  };
};

const updateMemberMedicationService = async (
  currentUser,
  memberId,
  medicationId,
  payload = {},
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedMedicationId = ensureObjectIdOrThrow(
    medicationId,
    "medicationId",
  );

  const medication = await Medication.findOne({
    _id: normalizedMedicationId,
    userId: parentUser._id,
  });

  if (!medication) {
    throw new CustomError("Medication not found", [], 404);
  }

  if (payload.name !== undefined) {
    const name = String(payload.name || "").trim();
    if (!name) {
      throw new CustomError("name cannot be empty", [], 400);
    }
    medication.name = name;
  }

  if (payload.dosage !== undefined) {
    medication.dosage = payload.dosage ? String(payload.dosage).trim() : null;
  }

  if (payload.frequency !== undefined) {
    medication.frequency = payload.frequency
      ? String(payload.frequency).trim()
      : null;
  }

  if (payload.startDate !== undefined) {
    medication.startDate = toDateOrNull(payload.startDate, "startDate");
  }

  if (payload.endDate !== undefined) {
    medication.endDate = toDateOrNull(payload.endDate, "endDate");
  }

  if (payload.notes !== undefined) {
    medication.notes = payload.notes ? String(payload.notes).trim() : null;
  }

  if (payload.time !== undefined) {
    medication.time = payload.time ? String(payload.time).trim() : null;
  }

  if (payload.isActive !== undefined) {
    medication.isActive = Boolean(payload.isActive);
  }

  await medication.save();

  return {
    medication: mapMedication(medication),
  };
};

const deleteMemberMedicationService = async (
  currentUser,
  memberId,
  medicationId,
) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);
  const normalizedMedicationId = ensureObjectIdOrThrow(
    medicationId,
    "medicationId",
  );

  const deleted = await Medication.findOneAndDelete({
    _id: normalizedMedicationId,
    userId: parentUser._id,
  });

  if (!deleted) {
    throw new CustomError("Medication not found", [], 404);
  }

  await MedicationHistory.deleteMany({ medicationId: deleted._id });

  return {
    deletedMedicationId: String(deleted._id),
  };
};

module.exports = {
  createMemberMedicationService,
  updateMemberMedicationService,
  deleteMemberMedicationService,
};
