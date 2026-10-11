import mongoose from "mongoose";
import { ALL_TASK_STATUSES, TASK_STATUS } from "../config/taskStatus.js";
import { ALL_TASK_CATEGORIES } from "../config/taskCategory.js";
import { ALL_TASK_SOURCES, TASK_SOURCE } from "../config/taskSource.js";

const preparationTaskSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    // Coordinator responsible for the task (the creator, for legacy manual
    // tasks). Authorization for access/updates is always re-derived from the
    // booking's current assigned coordinator (not this field), so a
    // reassignment can't leave orphaned access.
    coordinator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Stable identifier of a generated task within its booking (e.g.
    // "food:verify_quantity"). Unique per booking, so regenerating tasks on
    // every page visit can never create duplicates. Absent on manual tasks.
    key: {
      type: String,
      default: undefined,
    },
    source: {
      type: String,
      enum: ALL_TASK_SOURCES,
      default: TASK_SOURCE.MANUAL,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ALL_TASK_CATEGORIES,
      required: [true, "Category is required"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Why this task exists, derived from the booking's data (e.g. "Customer
    // selected 3 food items: …"). Empty for legacy manual tasks.
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ALL_TASK_STATUSES,
      default: TASK_STATUS.PENDING,
    },
  },
  { timestamps: true }
);

preparationTaskSchema.index(
  { booking: 1, key: 1 },
  { unique: true, partialFilterExpression: { key: { $type: "string" } } }
);

const PreparationTask = mongoose.model("PreparationTask", preparationTaskSchema);

export default PreparationTask;
