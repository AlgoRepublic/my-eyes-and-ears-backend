const mongoose = require("mongoose");
const { getUtcStartOfDay } = require("../utils/utcDateTime");

const checkinHistorySchema = new mongoose.Schema(
  {
    checkinReminderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CheckinReminder",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["completed", "skipped", "remind_later"],
      required: true,
      trim: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    remindAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

checkinHistorySchema.pre("validate", function validateDate() {
  if (this.date) {
    this.date = getUtcStartOfDay(this.date);
  }
});

checkinHistorySchema.index(
  { checkinReminderId: 1, date: 1 },
  { unique: true },
);

module.exports = mongoose.model("CheckinHistory", checkinHistorySchema);
