import mongoose from "mongoose";
import { ALL_BOOKING_STATUSES, BOOKING_STATUS } from "../config/bookingStatus.js";
import { ALL_PREPARATION_STATUSES, PREPARATION_STATUS } from "../config/preparationStatus.js";

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hall",
      required: true,
    },
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    eventType: {
      type: String,
      required: [true, "Event type is required"],
      trim: true,
    },
    eventDate: {
      type: Date,
      required: [true, "Event date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
    },
    guestCount: {
      type: Number,
      required: [true, "Guest count is required"],
      min: [1, "Guest count must be at least 1"],
    },
    requirements: {
      type: String,
      trim: true,
      default: "",
    },

    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      default: null,
    },
    food: [{ type: mongoose.Schema.Types.ObjectId, ref: "Food" }],
    decorations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Decoration" }],
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "AdditionalService" }],

    estimatedCost: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ALL_BOOKING_STATUSES,
      default: BOOKING_STATUS.PENDING,
    },

    // Manager who approved/rejected this booking, and when. Set only at the
    // moment of that decision (see updateBookingStatus) — never backfilled,
    // never overwritten by later transitions (confirmed/upcoming/completed).
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },

    // Overall event-preparation progress, set by the assigned coordinator.
    preparationStatus: {
      type: String,
      enum: ALL_PREPARATION_STATUSES,
      default: PREPARATION_STATUS.NOT_STARTED,
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
