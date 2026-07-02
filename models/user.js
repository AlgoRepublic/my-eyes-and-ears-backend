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
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    familyInvitationCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
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
    isEmailVerified: {
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

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string" },
    },
  },
);

userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phoneNumber: { $type: "string" },
    },
  },
);

userSchema.index(
  { familyInvitationCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      familyInvitationCode: { $type: "string" },
    },
  },
);

module.exports = mongoose.model("User", userSchema);
