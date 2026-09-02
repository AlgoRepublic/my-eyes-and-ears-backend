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

      // Migrate legacy boolean locationRequested → string locationStatus.
      const migratedRequested = await User.updateMany(
        {
          locationRequested: true,
          locationStatus: { $exists: false },
        },
        { $set: { locationStatus: "requested" } },
      );
      const migratedCompleted = await User.updateMany(
        {
          locationRequested: false,
          locationStatus: { $exists: false },
        },
        { $set: { locationStatus: "completed" } },
      );

      if (
        migratedRequested.modifiedCount > 0 ||
        migratedCompleted.modifiedCount > 0
      ) {
        console.log(
          `✅ Migrated locationRequested → locationStatus (requested: ${migratedRequested.modifiedCount}, completed: ${migratedCompleted.modifiedCount})`,
        );
      }

      await User.updateMany(
        { locationRequested: { $exists: true } },
        { $unset: { locationRequested: "" } },
      );

      // Parents who already shared GPS and are still "requested" → completed.
      const clearedLocationRequest = await User.updateMany(
        {
          role: "parent",
          "location.latitude": { $type: "number" },
          "location.longitude": { $type: "number" },
          locationStatus: "requested",
        },
        { $set: { locationStatus: "completed" } },
      );

      if (clearedLocationRequest.modifiedCount > 0) {
        console.log(
          `✅ Cleared locationStatus for ${clearedLocationRequest.modifiedCount} parent(s) with GPS`,
        );
      }

      await User.updateMany(
        { locationStatus: { $exists: false } },
        { $set: { locationStatus: "requested" } },
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
