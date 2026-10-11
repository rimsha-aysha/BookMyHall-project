import mongoose from "mongoose";

// Single-restaurant deployment — exactly one Settings document ever exists.
// See settings.controller.js for the get-or-create-default logic.
const settingsSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      trim: true,
      default: "BookMyHall",
    },
    tagline: {
      type: String,
      trim: true,
      default: "Hall & event booking for this restaurant.",
    },
    contactEmail: {
      type: String,
      trim: true,
      default: "",
    },
    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    policyNotes: {
      type: String,
      trim: true,
      default: "",
    },
    advancePaymentPercentage: {
      type: Number,
      min: [1, "Advance payment percentage must be at least 1"],
      max: [100, "Advance payment percentage cannot exceed 100"],
      default: 50,
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;
