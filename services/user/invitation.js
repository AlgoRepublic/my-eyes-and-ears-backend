const crypto = require("crypto");
const User = require("../../models/user");
const { CustomError } = require("../../utils/error");

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_CODE_LENGTH = 8;

const buildInvitationDetails = (user) => {
  const lastInvitationTime = user.lastInvitationTime || null;
  const invitationCode = user.familyInvitationCode || null;
  const isProfileCompleted = Boolean(user.isProfileCompleted);

  let status = "waitingForActivation";

  if (isProfileCompleted) {
    status = "activated";
  } else if (lastInvitationTime) {
    const invitationAgeMs = Date.now() - new Date(lastInvitationTime).getTime();

    if (invitationAgeMs > INVITATION_EXPIRY_MS) {
      status = "invitationExpired";
    }
  }

  return {
    invitationCode,
    lastInvitationTime,
    status,
  };
};

const generateInvitationCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(INVITATION_CODE_LENGTH);
  let code = "";

  for (let index = 0; index < randomBytes.length; index += 1) {
    code += chars[randomBytes[index] % chars.length];
  }

  return code;
};

const buildUniqueInvitationCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const invitationCode = generateInvitationCode();
    const existing = await User.findOne({
      familyInvitationCode: invitationCode,
    }).select("_id");

    if (!existing) {
      return invitationCode;
    }
  }

  throw new CustomError("Unable to generate invitation code", [], 500);
};

module.exports = {
  INVITATION_EXPIRY_MS,
  buildInvitationDetails,
  buildUniqueInvitationCode,
};
