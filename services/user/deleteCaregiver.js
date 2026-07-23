const User = require("../../models/user");
const { ensureCaregiverMemberOrThrow } = require("./memberAccess");
const { softDeleteUser } = require("../../utils/userSoftDelete");

const deleteCaregiverService = async (currentUser, caregiverId) => {
  const caregiverUser = await ensureCaregiverMemberOrThrow(
    currentUser,
    caregiverId,
  );

  await softDeleteUser(caregiverUser);

  return {
    deletedCaregiverId: String(caregiverUser._id),
  };
};

module.exports = {
  deleteCaregiverService,
};
