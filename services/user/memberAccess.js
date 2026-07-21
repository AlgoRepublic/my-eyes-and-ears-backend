const mongoose = require("mongoose");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { getFamilyIdOrThrow } = require("../family/familyAccess");

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
  });

  if (!parentUser) {
    throw new CustomError("Parent member not found", [], 404);
  }

  return parentUser;
};

module.exports = {
  getCaregiverIdOrThrow,
  ensureObjectIdOrThrow,
  ensureParentMemberOrThrow,
};
