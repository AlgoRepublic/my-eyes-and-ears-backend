const Family = require("../../models/family");
const User = require("../../models/user");
const Medication = require("../../models/medication");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const { buildInvitationDetails } = require("./invitation");

const mapInviteStatus = (memberUser) => {
  const invitation = buildInvitationDetails(memberUser);

  // let status = "pending";
  // if (invitation.status === "activated") {
  //   status = "accepted";
  // } else if (invitation.status === "invitationExpired") {
  //   status = "expired";
  // }

  // return {
  //   status,
  //   createdAt: memberUser.lastInvitationTime || memberUser.createdAt,
  //   updatedAt:
  //     memberUser.updatedAt ||
  //     memberUser.lastInvitationTime ||
  //     memberUser.createdAt,
  // };
  return invitation;
};

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
    User.find({ familyId }).sort({ createdAt: 1 }),
  ]);

  const members = familyUsers.filter((item) => item.role === "parent");
  const caregivers = familyUsers.filter((item) => item.role === "caregiver");

  const memberIds = members.map((item) => item._id);
  const medicationCounts = memberIds.length
    ? await Medication.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
          },
        },
        {
          $group: {
            _id: "$userId",
            count: { $sum: 1 },
          },
        },
      ])
    : [];

  const medicationCountByUserId = medicationCounts.reduce(
    (accumulator, item) => {
      accumulator.set(String(item._id), item.count);
      return accumulator;
    },
    new Map(),
  );

  return {
    family: {
      id: familyId,
      name: buildFamilyName(family, caregivers),
      memberCount: members.length,
      caregiverCount: caregivers.length,
      members: members.map((memberUser) => ({
        id: memberUser._id,
        relation: memberUser.relation,
        name: memberUser.name,
        avatarColor: memberUser.avatarColor,
        location: memberUser.location,
        medicationCount:
          medicationCountByUserId.get(String(memberUser._id)) || 0,
        invitation: mapInviteStatus(memberUser),
      })),
      caregivers: caregivers.map((caregiverUser) => ({
        id: caregiverUser._id,
        name: caregiverUser.name,
        avatarColor: caregiverUser.avatarColor,
        role: caregiverUser.isPrimary ? "admin" : "caregiver",
        isCurrentUser: String(caregiverUser._id) === String(currentCaregiverId),
      })),
    },
  };
};

module.exports = {
  getFamilyDetailsService,
};
