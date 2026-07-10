const mongoose = require("mongoose");

const getStartOfDay = (inputDate) => {
  const date = new Date(inputDate);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const medicationHistorySchema = new mongoose.Schema(
  {
    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
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
      enum: ["taken", "skipped", "remind_later"],
      required: true,
      trim: true,
    },
    takenAt: {
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

medicationHistorySchema.pre("validate", function (next) {
  if (this.date) {
    this.date = getStartOfDay(this.date);
  }
  next();
});

medicationHistorySchema.index({ medicationId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("MedicationHistory", medicationHistorySchema);
