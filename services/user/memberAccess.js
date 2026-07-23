const mongoose = require("mongoose");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const getCaregiverIdOrThrow = (currentUser) => {
  const caregiverId = currentUser?._id || currentUser?.id;

  if (!caregiverId) {
    throw new CustomError("Authenticated caregiver is required", [], 401);
  }

  if (currentUser?.role && currentUser.role !== "caregiver") {
    throw new CustomError("Only caregivers can manage family members", [], 403);
  }

  return caregiverId;
};

const ensureObjectIdOrThrow = (value, fieldName) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    throw new CustomError(`${fieldName} is required`, [], 400);
  }

  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    throw new CustomError(`Invalid ${fieldName}`, [], 400);
  }

  return normalized;
};

const ensureParentMemberOrThrow = async (currentUser, memberId) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);
  const normalizedMemberId = ensureObjectIdOrThrow(memberId, "memberId");

  const parentUser = await User.findOne({
    _id: normalizedMemberId,
    familyId,
    role: "parent",
    ...ACTIVE_USER_FILTER,
  });

  if (!parentUser) {
    throw new CustomError("Parent member not found", [], 404);
  }

  return parentUser;
};

const ensurePrimaryCaregiverOrThrow = (currentUser) => {
  const caregiverId = getCaregiverIdOrThrow(currentUser);

  if (!currentUser?.isPrimary) {
    throw new CustomError(
      "Only the primary caregiver can delete caregivers",
      [],
      403,
    );
  }

  return caregiverId;
};

const ensureCaregiverMemberOrThrow = async (currentUser, caregiverId) => {
  ensurePrimaryCaregiverOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);
  const normalizedCaregiverId = ensureObjectIdOrThrow(
    caregiverId,
    "caregiverId",
  );

  const caregiverUser = await User.findOne({
    _id: normalizedCaregiverId,
    familyId,
    role: "caregiver",
    ...ACTIVE_USER_FILTER,
  });

  if (!caregiverUser) {
    throw new CustomError("Caregiver not found", [], 404);
  }

  if (caregiverUser.isPrimary) {
    throw new CustomError("Primary caregiver cannot be deleted", [], 400);
  }

  return caregiverUser;
};

module.exports = {
  getCaregiverIdOrThrow,
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
  ensurePrimaryCaregiverOrThrow,
  ensureCaregiverMemberOrThrow,
};
