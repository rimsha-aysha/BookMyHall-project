import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import { ROLES } from "../config/roles.js";
import { BOOKING_STATUS } from "../config/bookingStatus.js";

export const createReview = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    if (booking.customer?.toString() !== req.user.id) {
      res.status(403);
      return next(new Error("You are not authorized to review this booking"));
    }

    if (booking.status !== BOOKING_STATUS.COMPLETED) {
      res.status(400);
      return next(new Error("Only completed bookings can be reviewed"));
    }

    const existing = await Review.findOne({ booking: booking._id });
    if (existing) {
      res.status(409);
      return next(new Error("A review has already been submitted for this booking"));
    }

    const review = await Review.create({
      booking: booking._id,
      customer: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment || "",
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const getReviewForBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    const isOwner = booking.customer?.toString() === req.user.id;
    const isManagement = [ROLES.MANAGER, ROLES.OWNER].includes(req.user.role);
    if (!isOwner && !isManagement) {
      res.status(403);
      return next(new Error("Not authorized to view this review"));
    }

    const review = await Review.findOne({ booking: booking._id });
    res.json({ success: true, data: review || null });
  } catch (error) {
    next(error);
  }
};

// Public — aggregate rating plus the most recent reviews for a hall, so
// customers can judge a hall before booking. Only the reviewer's first name
// is exposed.
export const getHallReviews = async (req, res, next) => {
  try {
    const bookingIds = await Booking.find({ hall: req.params.hallId }).distinct("_id");
    const reviews = await Review.find({ booking: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .populate("customer", "name")
      .populate("booking", "eventType eventDate");

    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;

    res.json({
      success: true,
      data: {
        average,
        count,
        reviews: reviews.slice(0, 10).map((r) => ({
          _id: r._id,
          rating: r.rating,
          comment: r.comment,
          reviewerName: r.customer?.name?.split(" ")[0] || "Customer",
          eventType: r.booking?.eventType || null,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
