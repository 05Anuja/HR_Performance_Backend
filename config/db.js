const mongoose = require("mongoose");
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.Mongo_Uri);
    console.log(process.env.Mongo_Uri);
    console.log("Connected to mongodb");

    // Automatically drop the legacy email_1 unique index if it exists in the database
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections({ name: "users" }).toArray();
      if (collections.length > 0) {
        await db.collection("users").dropIndex("email_1");
        console.log("Legacy unique index 'email_1' dropped successfully.");
      }
    } catch (indexError) {
      // Ignore if index 'email_1' doesn't exist or is already dropped
      if (indexError.codeName !== "IndexNotFound") {
        console.log(
          "Error checking/dropping email_1 index:",
          indexError.message,
        );
      }
    }
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
module.exports = connectDB;
