const mongoose = require("mongoose");

// profile setting columns
const profileSettingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fontSize: {
      type: String,
      default: null,
      // enum: ["small", "medium", "large"],
      // default: "medium",
    },
    highContrast: {
      type: Boolean,
      default: false,
    },
    voiceAssistance: {
      type: Boolean,
      default: false,
    },
    sosAlerts: {
      type: Boolean,
      default: true,
    },
    missedCheckIns: {
      type: Boolean,
      default: true,
    },
    missedMedications: {
      type: Boolean,
      default: true,
    },
    newFamilyMessages: {
      type: Boolean,
      default: true,
    },
    weeklyDigest: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

profileSettingSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("ProfileSetting", profileSettingSchema);
