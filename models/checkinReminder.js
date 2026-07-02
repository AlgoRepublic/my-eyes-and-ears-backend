const mongoose = require("mongoose");

const checkinReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      default: null,
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CheckinReminder", checkinReminderSchema);
