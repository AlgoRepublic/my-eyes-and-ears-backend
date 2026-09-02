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

      // Legacy user.location was a plain address string; convert to object shape.
      const legacyLocationUsers = await User.find({
        location: { $type: "string" },
      }).select("_id location");

      for (const legacyUser of legacyLocationUsers) {
        const address = String(legacyUser.location || "").trim();
        await User.updateOne(
          { _id: legacyUser._id },
          {
            $set: {
              location: address
                ? {
                    latitude: null,
                    longitude: null,
                    accuracy: null,
                    address,
                    city: null,
                    state: null,
                    country: null,
                    postalCode: null,
                    updatedAt: new Date(),
                  }
                : null,
            },
          },
        );
      }

      if (legacyLocationUsers.length > 0) {
        console.log(
          `✅ Migrated ${legacyLocationUsers.length} legacy string location(s)`,
        );
      }

      // Parents who already shared GPS coordinates no longer need a location request.
      const clearedLocationRequest = await User.updateMany(
        {
          role: "parent",
          "location.latitude": { $type: "number" },
          "location.longitude": { $type: "number" },
          locationRequested: { $ne: false },
        },
        { $set: { locationRequested: false } },
      );

      if (clearedLocationRequest.modifiedCount > 0) {
        console.log(
          `✅ Cleared locationRequested for ${clearedLocationRequest.modifiedCount} parent(s) with GPS`,
        );
      }

      await User.updateMany(
        { locationRequested: { $exists: false } },
        { $set: { locationRequested: true } },
      );

      await User.updateMany(
        { sosStatus: { $exists: false } },
        { $set: { sosStatus: null } },
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
