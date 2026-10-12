import mongoose from "mongoose";

// MONGODB_URI is the connection string (MongoDB Atlas). MONGO_URI is the
// older name, still accepted so an existing local .env keeps working.
export const getMongoUri = () => process.env.MONGODB_URI || process.env.MONGO_URI;

export const connectDB = async () => {
  const uri = getMongoUri();
  if (!uri) {
    console.error("MongoDB connection error: MONGODB_URI is not set in server/.env");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host} (database "${conn.connection.name}")`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }

  // Imported lazily so scripts that only need getMongoUri don't load models.
  const { runPaymentMigrations } = await import("../services/paymentLedger.js");
  await runPaymentMigrations();
};
