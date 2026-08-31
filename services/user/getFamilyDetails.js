const Family = require("../../models/family");
const User = require("../../models/user");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { buildMembersListResponse } = require("./buildMembersListResponse");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const {
  getConversationSummariesForMembers,
} = require("../chat/conversations");

const buildFamilyName = (family) => {
  return family?.name || "";
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

  const { familyConversation, individualConversationsByMemberId } =
    await getConversationSummariesForMembers(currentUser, members);

  const membersWithConversations = membersResponse.map((member) => ({
    ...member,
    familyConversation,
    individualConversation:
      individualConversationsByMemberId.get(String(member.id)) || null,
  }));

  return {
    family: {
      id: familyId,
      name: buildFamilyName(family),
      memberCount: members.length,
      caregiverCount: caregivers.length,
      members: membersWithConversations,
      familyConversation,
      caregivers: caregivers.map((caregiverUser) => ({
        id: caregiverUser._id,
        familyName: buildFamilyName(family),
        name: caregiverUser.name,
        email: caregiverUser.email,
        phoneNumber: caregiverUser.phoneNumber,
        avatarColor: caregiverUser.avatarColor,
        image: caregiverUser.image,
        isPrimary: caregiverUser.isPrimary,
        isCurrentUser: String(caregiverUser._id) === String(currentCaregiverId),
      })),
    },
  };
};

module.exports = {
  getFamilyDetailsService,
};
