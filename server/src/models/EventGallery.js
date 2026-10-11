import mongoose from "mongoose";

// A previously conducted event/program shown in the customer-facing gallery.
// Managed by Manager/Owner (see gallery.routes.js); only published entries
// are visible publicly.
const eventGallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    eventType: {
      type: String,
      required: [true, "Event type is required"],
      trim: true,
    },
    // Optional — an entry can outlive the hall it was held in, so the
    // reference may be null (or point at a since-deleted hall).
    hall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hall",
      default: null,
    },
    eventDate: {
      type: Date,
      default: null,
    },
    guestCount: {
      type: Number,
      min: [1, "Guest count must be at least 1"],
      default: null,
    },
    images: {
      type: [String],
      validate: {
        validator: (images) => Array.isArray(images) && images.length > 0,
        message: "At least one photo is required",
      },
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const EventGallery = mongoose.model("EventGallery", eventGallerySchema);

export default EventGallery;
