const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      default: null,
    },
    password: {
      type: String,
      required: false,
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      default: null,
    },
    role: {
      type: String,
      enum: ["caregiver", "parent"],
      required: true,
    },
    relation: {
      type: String,
      required: false,
      default: null,
    },
    avatarColor: {
      type: String,
      default: null,
    },
    image: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      default: null,
      trim: true,
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      default: null,
    },
    familyInvitationCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
    },
    lastInvitationTime: {
      type: Date,
      default: null,
    },
    familyName: {
      type: String,
      trim: true,
      default: "",
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    missedCheckInAlerts: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // this alert is for caregiver to get notified after 5 mnt if parent checkins
    caregiverMissedCheckinAlert: {
      type: Boolean,
      default: false,
    },
    emailVerificationOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    emailVerificationOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    forgotPasswordOtpHash: {
      type: String,
      default: null,
      select: false,
    },
    forgotPasswordOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    socialAccounts: [
      {
        source: {
          type: String,
          enum: ["google", "facebook", "apple"],
          required: true,
          lowercase: true,
          trim: true,
        },
        idToken: {
          type: String,
          required: true,
          trim: true,
        },
        linkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isEmailOtpValid = function (candidateOtp) {
  if (!candidateOtp || !this.emailVerificationOtpHash) return false;
  if (
    !this.emailVerificationOtpExpiresAt ||
    this.emailVerificationOtpExpiresAt < new Date()
  ) {
    return false;
  }

  const candidateHash = crypto
    .createHash("sha256")
    .update(String(candidateOtp))
    .digest("hex");

  return candidateHash === this.emailVerificationOtpHash;
};

const ACTIVE_USER_INDEX_FILTER = {
  isDeleted: false,
};

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string" },
      ...ACTIVE_USER_INDEX_FILTER,
    },
  },
);

userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phoneNumber: { $type: "string" },
      ...ACTIVE_USER_INDEX_FILTER,
    },
  },
);

userSchema.index(
  { familyInvitationCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      familyInvitationCode: { $type: "string" },
      ...ACTIVE_USER_INDEX_FILTER,
    },
  },
);

userSchema.index({ familyId: 1, role: 1, isDeleted: 1 });
userSchema.index(
  { familyId: 1, role: 1, isPrimary: 1 },
  {
    partialFilterExpression: {
      role: "caregiver",
      isPrimary: true,
      ...ACTIVE_USER_INDEX_FILTER,
    },
  },
);

module.exports = mongoose.model("User", userSchema);
