const Family = require("../../models/family");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const getCaregiverIdFromUser = (currentUser) => {
  const caregiverId = currentUser?._id || currentUser?.id;

  if (!caregiverId) {
    throw new CustomError("Authenticated caregiver is required", [], 401);
  }

  if (currentUser?.role && currentUser.role !== "caregiver") {
    throw new CustomError(
      "Only caregivers can access family resources",
      [],
      403,
    );
  }

  return caregiverId;
};

const resolveCaregiverFamilyId = async (currentUser) => {
  const caregiverId = getCaregiverIdFromUser(currentUser);

  const caregiver = await User.findOne({
    _id: caregiverId,
    ...ACTIVE_USER_FILTER,
  }).select("familyId familyName");

  if (!caregiver) {
    throw new CustomError("Caregiver not found", [], 404);
  }

  if (caregiver.familyId) {
    return caregiver.familyId;
  }

  const family = await Family.create({
    createdBy: caregiverId,
    name: caregiver.familyName || "",
  });

  await User.updateOne(
    { _id: caregiverId },
    { familyId: family._id, isPrimary: true },
  );
  await User.updateMany(
    { caregiverId, role: "parent", familyId: null, ...ACTIVE_USER_FILTER },
    { familyId: family._id },
  );

  return family._id;
};

const getFamilyIdOrThrow = async (currentUser) => {
  return resolveCaregiverFamilyId(currentUser);
};

const getPrimaryCaregiverByFamilyId = async (familyId) => {
  if (!familyId) {
    return null;
  }

  const primaryCaregiver = await User.findOne({
    familyId,
    role: "caregiver",
    isPrimary: true,
    ...ACTIVE_USER_FILTER,
  });

  if (primaryCaregiver) {
    return primaryCaregiver;
  }

  const family = await Family.findById(familyId).select("createdBy");
  if (!family?.createdBy) {
    return null;
  }

  return User.findOne({
    _id: family.createdBy,
    ...ACTIVE_USER_FILTER,
  });
};

module.exports = {
  resolveCaregiverFamilyId,
  getFamilyIdOrThrow,
  getPrimaryCaregiverByFamilyId,
};
