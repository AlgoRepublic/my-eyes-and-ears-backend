const mongoose = require("mongoose");
const User = require("../models/user");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ MongoDB Connected");

    try {
      await User.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } },
      );
      await User.syncIndexes();
      console.log("✅ User indexes synced");
    } catch (indexError) {
      console.error("❌ User index sync error:", indexError.message);
    }
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    // Don't exit process in dev for resilience, but in prod you might want to.
    // if (process.env.NODE_ENV === "production") process.exit(1);
  }
};

module.exports = connectDB;
