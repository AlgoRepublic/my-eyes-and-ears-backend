const User = require("../../models/user");
const Profile = require("../../models/profile");
const ProfileSetting = require("../../models/profileSetting");
const Contact = require("../../models/contact");
const CheckinReminder = require("../../models/checkinReminder");
const CheckinHistory = require("../../models/checkinHistory");
const Appointment = require("../../models/appointment");
const Medication = require("../../models/medication");
const MedicationHistory = require("../../models/medicationHistory");
const { ensureParentMemberOrThrow } = require("./memberAccess");

const deleteMemberService = async (currentUser, memberId) => {
  const parentUser = await ensureParentMemberOrThrow(currentUser, memberId);

  const medications = await Medication.find({ userId: parentUser._id }).select(
    "_id",
  );
  const medicationIds = medications.map((item) => item._id);

  await Promise.all([
    MedicationHistory.deleteMany({ userId: parentUser._id }),
    medicationIds.length > 0
      ? MedicationHistory.deleteMany({ medicationId: { $in: medicationIds } })
      : Promise.resolve(),
    Medication.deleteMany({ userId: parentUser._id }),
    Contact.deleteMany({ userId: parentUser._id }),
    CheckinReminder.deleteMany({ userId: parentUser._id }),
    CheckinHistory.deleteMany({ userId: parentUser._id }),
    Appointment.deleteMany({ userId: parentUser._id }),
    ProfileSetting.deleteMany({ userId: parentUser._id }),
    Profile.deleteMany({ userId: parentUser._id }),
    User.deleteOne({ _id: parentUser._id }),
  ]);

  return {
    deletedMemberId: String(parentUser._id),
  };
};

module.exports = {
  deleteMemberService,
};
