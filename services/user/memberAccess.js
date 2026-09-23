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

const ensureParentUserAccessOrThrow = async (currentUser, parentUserId) => {
  const normalizedParentId = ensureObjectIdOrThrow(parentUserId, "userId");
  const currentUserId = String(currentUser?._id || currentUser?.id || "");
  const currentRole = currentUser?.role;

  if (currentRole === "parent") {
    if (currentUserId !== String(normalizedParentId)) {
      throw new CustomError(
        "You can only access your own family member data",
        [],
        403,
      );
    }

    const parentUser = await User.findOne({
      _id: normalizedParentId,
      role: "parent",
      ...ACTIVE_USER_FILTER,
    });

    if (!parentUser) {
      throw new CustomError("Parent user not found", [], 404);
    }

    return parentUser;
  }

  if (currentRole === "caregiver") {
    return ensureParentMemberOrThrow(currentUser, normalizedParentId);
  }

  throw new CustomError(
    "Only parent or caregiver users can access this endpoint",
    [],
    403,
  );
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
  ensureParentUserAccessOrThrow,
  ensurePrimaryCaregiverOrThrow,
  ensureCaregiverMemberOrThrow,
};
