const Family = require("../../models/family");
const User = require("../../models/user");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { buildMembersListResponse } = require("./buildMembersListResponse");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const buildFamilyName = (family, caregivers = []) => {
  if (family?.name) {
    return family.name;
  }

  const caregiverWithFamilyName = caregivers.find((item) => item.familyName);
  return caregiverWithFamilyName?.familyName || "";
};

const getFamilyDetailsService = async (currentUser) => {
  const currentCaregiverId = getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const [family, familyUsers] = await Promise.all([
    Family.findById(familyId),
    User.find({
      familyId,
      ...ACTIVE_USER_FILTER,
    }).sort({ createdAt: 1 }),
  ]);

  const members = familyUsers.filter((item) => item.role === "parent");
  const caregivers = familyUsers.filter((item) => item.role === "caregiver");

  const membersResponse = await buildMembersListResponse(members, {
    includeMedicationCount: true,
  });

  return {
    family: {
      id: familyId,
      name: buildFamilyName(family, caregivers),
      memberCount: members.length,
      caregiverCount: caregivers.length,
      members: membersResponse,
      caregivers: caregivers.map((caregiverUser) => ({
        id: caregiverUser._id,
        name: caregiverUser.name,
        email: caregiverUser.email,
        phoneNumber: caregiverUser.phoneNumber,
        avatarColor: caregiverUser.avatarColor,
        isPrimary: caregiverUser.isPrimary,
        isCurrentUser: String(caregiverUser._id) === String(currentCaregiverId),
      })),
    },
  };
};

module.exports = {
  getFamilyDetailsService,
};
