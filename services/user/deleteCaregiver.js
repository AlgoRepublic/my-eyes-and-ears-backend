const User = require("../../models/user");
const { ensureCaregiverMemberOrThrow } = require("./memberAccess");

const deleteCaregiverService = async (currentUser, caregiverId) => {
  const caregiverUser = await ensureCaregiverMemberOrThrow(
    currentUser,
    caregiverId,
  );

  await User.deleteOne({ _id: caregiverUser._id });

  return {
    deletedCaregiverId: String(caregiverUser._id),
  };
};

module.exports = {
  deleteCaregiverService,
};
