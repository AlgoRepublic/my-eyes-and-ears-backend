const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    // Don't exit process in dev for resilience, but in prod you might want to.
    // if (process.env.NODE_ENV === "production") process.exit(1);
  }
};

module.exports = connectDB;
