import PreparationTask from "../models/PreparationTask.js";
import Booking from "../models/Booking.js";
import { ROLES } from "../config/roles.js";
import { TASK_STATUS } from "../config/taskStatus.js";
import { TASK_SOURCE } from "../config/taskSource.js";
import { PREPARATION_STATUS } from "../config/preparationStatus.js";
import { syncPreparationTasks } from "../services/preparationTasks.js";

const isAssignedCoordinator = (booking, userId) =>
  Boolean(booking.coordinator) && booking.coordinator.toString() === userId;

const isManagement = (role) => [ROLES.MANAGER, ROLES.OWNER].includes(role);

// Tasks are generated from the booking (see services/preparationTasks.js) —
// there is deliberately no endpoint for coordinators to create them.
export const listTasksForBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    const allowed = isAssignedCoordinator(booking, req.user.id) || isManagement(req.user.role);
    if (!allowed) {
      res.status(403);
      return next(new Error("Not authorized to view tasks for this booking"));
    }

    // Idempotent; backfills bookings assigned before tasks were generated.
    await syncPreparationTasks(booking);

    const tasks = await PreparationTask.find({ booking: booking._id })
      .sort({ createdAt: 1, _id: 1 })
      .populate("coordinator", "name email");
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (req, res, next) => {
  try {
    const task = await PreparationTask.findById(req.params.taskId);
    if (!task) {
      res.status(404);
      return next(new Error("Task not found"));
    }

    const booking = await Booking.findById(task.booking);
    if (!booking || !isAssignedCoordinator(booking, req.user.id)) {
      res.status(403);
      return next(new Error("You are not authorized to update this task"));
    }

    task.status = req.body.status;
    await task.save();

    // Reopening a required task means preparation is no longer complete.
    if (
      task.source === TASK_SOURCE.SYSTEM &&
      task.status !== TASK_STATUS.COMPLETED &&
      booking.preparationStatus === PREPARATION_STATUS.COMPLETED
    ) {
      booking.preparationStatus = PREPARATION_STATUS.IN_PROGRESS;
      await booking.save();
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};
