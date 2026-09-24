const crypto = require("crypto");
const User = require("../../models/user");
const Family = require("../../models/family");
const { CustomError } = require("../../utils/error");
const { getFamilyIdOrThrow } = require("../family/familyAccess");
const { getCaregiverIdOrThrow } = require("./memberAccess");
const {
  createCaregiverProfileSetting,
} = require("./caregiverNotificationSettings");
const { ACTIVE_USER_FILTER } = require("../../utils/userSoftDelete");
const {
  sendCaregiverCredentialsEmail,
  sendCaregiverInviteEmail,
} = require("../notification/email");
const { dispatchEmail } = require("../notification/emailDispatch");

const PASSWORD_LENGTH = 12;

const generateTemporaryPassword = () => {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?&";
  const randomBytes = crypto.randomBytes(PASSWORD_LENGTH);

  let password = "";

  for (let index = 0; index < PASSWORD_LENGTH; index += 1) {
    password += charset[randomBytes[index] % charset.length];
  }

  return password;
};

const buildFamilyName = async (familyId) => {
  const family = await Family.findById(familyId);
  return family?.name || null;
};

const buildCaregiverResponse = (caregiverUser) => {
  return {
    id: caregiverUser._id,
    role: caregiverUser.role,
    familyId: caregiverUser.familyId,
    isPrimary: Boolean(caregiverUser.isPrimary),
    name: caregiverUser.name,
    email: caregiverUser.email,
    phoneNumber: caregiverUser.phoneNumber,
    relation: caregiverUser.relation,
    avatarColor: caregiverUser.avatarColor,
    image: caregiverUser.image,
    familyName: buildFamilyName(caregiverUser.familyId),
    isProfileCompleted: caregiverUser.isProfileCompleted,
    isEmailVerified: caregiverUser.isEmailVerified,
    hasPassword: Boolean(caregiverUser.password),
    createdAt: caregiverUser.createdAt,
    updatedAt: caregiverUser.updatedAt,
  };
};

const addCaregiverService = async (currentUser, data = {}) => {
  getCaregiverIdOrThrow(currentUser);
  const familyId = await getFamilyIdOrThrow(currentUser);

  const userPayload = data || {};

  const name = String(userPayload.name || "").trim();
  const relation = userPayload.relation
    ? String(userPayload.relation).trim()
    : null;
  const email = userPayload.email
    ? String(userPayload.email).toLowerCase().trim()
    : null;
  const phoneNumber = userPayload.phoneNumber
    ? String(userPayload.phoneNumber).trim()
    : null;

  if (!name) {
    throw new CustomError("Caregiver name is required", [], 400);
  }

  if (!email) {
    throw new CustomError(
      "Caregiver email is required to send login credentials",
      [],
      400,
    );
  }

  const existingEmail = await User.findOne({
    email,
    ...ACTIVE_USER_FILTER,
  }).select("_id");
  if (existingEmail) {
    throw new CustomError("Email already exists", [], 400);
  }

  if (phoneNumber) {
    const existingPhone = await User.findOne({
      phoneNumber,
      ...ACTIVE_USER_FILTER,
    }).select("_id");
    if (existingPhone) {
      throw new CustomError("Phone number already exists", [], 400);
    }
  }

  const password = generateTemporaryPassword();
  const inviterName = String(currentUser.name || "").trim() || "Your caregiver";
  const familyName = await buildFamilyName(familyId);
  let caregiverUser;

  try {
    caregiverUser = await User.create({
      name,
      email,
      phoneNumber,
      role: "caregiver",
      relation,
      avatarColor: userPayload.avatarColor || null,
      image: userPayload.image || null,
      familyId,
      isPrimary: false,
      familyInvitationCode: null,
      lastInvitationTime: null,
      isProfileCompleted: true,
      isEmailVerified: true,
      password,
      emailVerificationOtpHash: null,
      emailVerificationOtpExpiresAt: null,
    });

    await createCaregiverProfileSetting(caregiverUser._id);

    await dispatchEmail(async () => {
      await sendCaregiverInviteEmail({
        to: email,
        caregiverName: caregiverUser.name,
        inviterName,
        familyName,
      });
      await sendCaregiverCredentialsEmail({
        to: email,
        caregiverName: caregiverUser.name,
        password,
      });
    }, "caregiver invite and credentials");
  } catch (error) {
    if (caregiverUser?._id) {
      await User.deleteOne({ _id: caregiverUser._id });
    }

    throw error;
  }
  const verification = {
    channel: "email",
    email: caregiverUser.email,
  };

  if (process.env.NODE_ENV !== "production") {
    verification.password = password;
  }

  return {
    user: buildCaregiverResponse(caregiverUser),
    verification,
  };
};

module.exports = {
  addCaregiverService,
  buildCaregiverResponse,
};
