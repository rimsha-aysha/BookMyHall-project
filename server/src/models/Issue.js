import mongoose from "mongoose";
import { ALL_ISSUE_STATUSES, ISSUE_STATUS } from "../config/issueStatus.js";

const issueSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    // Coordinator who reported the issue. Access is re-derived from the
    // booking's current assigned coordinator (see issue.controller.js),
    // not this field — same convention as PreparationTask.
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    status: {
      type: String,
      enum: ALL_ISSUE_STATUSES,
      default: ISSUE_STATUS.OPEN,
    },
  },
  { timestamps: true }
);

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;
