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
  },
  { timestamps: true },
);

module.exports = mongoose.model("ProfileSetting", profileSettingSchema);
