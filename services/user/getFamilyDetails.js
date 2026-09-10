const Family = require("../../models/family");
const User = require("../../models/user");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { buildMembersListResponse } = require("./buildMembersListResponse");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");

const buildFamilyName = (family) => {
  return family?.name || "";
};

const buildFamilyDetailsResponse = async (currentUser, familyId) => {
  const currentUserId = String(currentUser?._id || currentUser?.id || "");

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
    id: familyId,
    name: buildFamilyName(family),
    memberCount: members.length,
    caregiverCount: caregivers.length,
    members: membersResponse,
    caregivers: caregivers.map((caregiverUser) => ({
      id: caregiverUser._id,
      familyName: buildFamilyName(family),
      name: caregiverUser.name,
      email: caregiverUser.email,
      phoneNumber: caregiverUser.phoneNumber,
      avatarColor: caregiverUser.avatarColor,
      image: caregiverUser.image,
      isPrimary: caregiverUser.isPrimary,
      isCurrentUser: String(caregiverUser._id) === currentUserId,
    })),
  };
};

const getFamilyDetailsService = async (currentUser) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);
  const family = await buildFamilyDetailsResponse(currentUser, familyId);

  return {
    family,
  };
};

module.exports = {
  buildFamilyDetailsResponse,
  getFamilyDetailsService,
};
