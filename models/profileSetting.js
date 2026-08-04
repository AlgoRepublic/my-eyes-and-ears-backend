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
    hapticFeedback: {
      type: Boolean,
      default: false,
    },
    voiceSpeed: {
      type: Number,
      default: 1,
    },
    appLanguage: {
      type: String,
      default: null,
    },
    readingVoice: {
      type: String,
      default: null,
    },
    translationLanguage: {
      type: String,
      default: null,
    },
    autoReadAfterScan: {
      type: Boolean,
      default: false,
    },
    dailyCheckInReminders: {
      type: Boolean,
      default: true,
    },
    medicationReminders: {
      type: Boolean,
      default: true,
    },
    appointmentsReminders: {
      type: Boolean,
      default: true,
    },
    familyMessages: {
      type: Boolean,
      default: true,
    },
    doNotDisturb: {
      type: Boolean,
      default: false,
    },
    shareCheckInStatus: {
      type: Boolean,
      default: true,
    },
    shareMedication: {
      type: Boolean,
      default: true,
    },
    shareLocation: {
      type: Boolean,
      default: true,
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
