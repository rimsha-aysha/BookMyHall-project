import mongoose from "mongoose";
import {
  ALL_BOOKING_STATUSES,
  BOOKING_STATUS,
  ALL_BOOKING_SOURCES,
  BOOKING_SOURCE,
} from "../config/bookingStatus.js";
import { ALL_PREPARATION_STATUSES, PREPARATION_STATUS } from "../config/preparationStatus.js";
import { ALL_BOOKING_PAYMENT_STATUSES, BOOKING_PAYMENT_STATUS } from "../config/paymentStatus.js";
import { INDIAN_MOBILE_REGEX, INVALID_PHONE_MESSAGE, normalizePhone } from "../utils/phone.js";

const isWalkIn = function isWalkIn() {
  return this.source === BOOKING_SOURCE.WALK_IN;
};

// Contact details for a walk-in customer, who may have no online account.
const walkInCustomerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: [true, "Customer name is required"] },
    phone: {
      type: String,
      trim: true,
      set: normalizePhone,
      match: [INDIAN_MOBILE_REGEX, INVALID_PHONE_MESSAGE],
      required: [true, "Customer phone number is required"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    // Online bookings belong to a customer account. Walk-in bookings may
    // have none — their contact details live in walkInCustomer instead.
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [
        function customerRequiredForOnline() {
          return !isWalkIn.call(this);
        },
        "Customer is required",
      ],
      default: null,
    },
    // Existing bookings have no source field and read as "online".
    source: {
      type: String,
      enum: ALL_BOOKING_SOURCES,
      default: BOOKING_SOURCE.ONLINE,
    },
    walkInCustomer: {
      type: walkInCustomerSchema,
      required: [isWalkIn, "Walk-in customer details are required"],
      default: undefined,
    },
    // Manager/Owner who entered a walk-in booking.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

    // Cached totals of this booking's SUCCESS payments (Razorpay + confirmed
    // offline). Recomputed from the Payment records after every payment
    // change (services/paymentLedger.js) — never incremented, so a payment
    // can't be counted twice. A new booking is always unpaid.
    amountPaid: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ALL_BOOKING_PAYMENT_STATUSES,
      default: BOOKING_PAYMENT_STATUS.UNPAID,
    },
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
