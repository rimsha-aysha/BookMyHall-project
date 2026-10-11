import Issue from "../models/Issue.js";
import Booking from "../models/Booking.js";
import { ROLES } from "../config/roles.js";

const isAssignedCoordinator = (booking, userId) =>
  Boolean(booking.coordinator) && booking.coordinator.toString() === userId;

const isManagement = (role) => [ROLES.MANAGER, ROLES.OWNER].includes(role);

export const createIssue = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    if (!isAssignedCoordinator(booking, req.user.id)) {
      res.status(403);
      return next(new Error("You are not the coordinator assigned to this booking"));
    }

    const issue = await Issue.create({
      booking: booking._id,
      coordinator: req.user.id,
      title: req.body.title,
      description: req.body.description || "",
    });

    res.status(201).json({ success: true, data: issue });
  } catch (error) {
    next(error);
  }
};

export const listIssuesForBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    const allowed = isAssignedCoordinator(booking, req.user.id) || isManagement(req.user.role);
    if (!allowed) {
      res.status(403);
      return next(new Error("Not authorized to view issues for this booking"));
    }

    const issues = await Issue.find({ booking: booking._id })
      .sort({ createdAt: -1 })
      .populate("coordinator", "name email");
    res.json({ success: true, count: issues.length, data: issues });
  } catch (error) {
    next(error);
  }
};

// Manager/owner only (enforced at the route) — coordinators report issues
// but do not resolve them themselves.
export const updateIssueStatus = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) {
      res.status(404);
      return next(new Error("Issue not found"));
    }

    issue.status = req.body.status;
    await issue.save();

    res.json({ success: true, data: issue });
  } catch (error) {
    next(error);
  }
};

// Manager/owner — every issue across all bookings (optionally ?status=open),
// so open problems can be acted on without opening each booking.
export const listAllIssues = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const issues = await Issue.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .populate("coordinator", "name email")
      .populate({
        path: "booking",
        select: "eventType eventDate startTime hall customer status",
        populate: [
          { path: "hall", select: "name" },
          { path: "customer", select: "name" },
        ],
      });
    res.json({ success: true, count: issues.length, data: issues });
  } catch (error) {
    next(error);
  }
};
