import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import Hall from "../models/Hall.js";
import User from "../models/User.js";
import PreparationTask from "../models/PreparationTask.js";
import Issue from "../models/Issue.js";
import Review from "../models/Review.js";
import EventGallery from "../models/EventGallery.js";
import { ROLES } from "../config/roles.js";
import { ALL_BOOKING_STATUSES, BOOKING_STATUS } from "../config/bookingStatus.js";
import { PAYMENT_STATUS, PAYMENT_GATEWAY, BOOKING_PAYMENT_STATUS } from "../config/paymentStatus.js";
import { TASK_STATUS } from "../config/taskStatus.js";
import { ISSUE_STATUS } from "../config/issueStatus.js";
import { ALL_PREPARATION_STATUSES } from "../config/preparationStatus.js";
import { ALL_TASK_STATUSES } from "../config/taskStatus.js";

// Shared by getOverview and getManagerOverview — one place that counts
// bookings per status, reused instead of duplicated.
const computeBookingStatusBreakdown = (bookings) => {
  const byStatus = Object.fromEntries(ALL_BOOKING_STATUSES.map((s) => [s, 0]));
  bookings.forEach((b) => {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
  });
  return byStatus;
};

// Shared by getOverview and getManagerOverview — per-coordinator workload,
// reused instead of duplicated.
const computeCoordinatorActivity = (coordinators, bookings, tasks, issues) =>
  coordinators.map((c) => {
    const cid = c._id.toString();
    const assignedBookings = bookings.filter(
      (b) => b.coordinator && (b.coordinator._id || b.coordinator).toString() === cid
    ).length;
    const coordTasks = tasks.filter((t) => t.coordinator.toString() === cid);
    const coordIssues = issues.filter((i) => i.coordinator.toString() === cid);
    return {
      coordinatorId: c._id,
      name: c.name,
      email: c.email,
      assignedBookings,
      tasksTotal: coordTasks.length,
      tasksCompleted: coordTasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length,
      issuesReported: coordIssues.length,
      issuesResolved: coordIssues.filter((i) => i.status === ISSUE_STATUS.RESOLVED).length,
    };
  });

// Per-manager approve/reject attribution, driven by Booking.decidedBy/status
// (set once, at the moment of that decision — see updateBookingStatus).
// REJECTED is terminal and APPROVED never reverts to PENDING, so a decided
// booking's current status alone tells us which way that decision went.
const computeManagerActivity = (managers, bookings) =>
  managers.map((m) => {
    const mid = m._id.toString();
    const decided = bookings.filter((b) => b.decidedBy && b.decidedBy.toString() === mid);
    return {
      managerId: m._id,
      name: m.name,
      email: m.email,
      approved: decided.filter((b) => b.status !== BOOKING_STATUS.REJECTED).length,
      rejected: decided.filter((b) => b.status === BOOKING_STATUS.REJECTED).length,
    };
  });

// A single read-only aggregate view over existing data — no new models, no
// separate "reports" feature. This is the Owner's dashboard/analytics source.
export const getOverview = async (req, res, next) => {
  try {
    const [bookings, payments, halls, coordinators, managers, tasks, issues, totalCustomers, reviews, galleryCount] =
      await Promise.all([
        Booking.find({}).populate("hall", "name").populate("customer", "name").populate("coordinator", "name"),
        Payment.find({ status: PAYMENT_STATUS.SUCCESS }),
        Hall.find({}),
        User.find({ role: ROLES.COORDINATOR }).select("name email"),
        User.find({ role: ROLES.MANAGER }).select("name email"),
        PreparationTask.find({}),
        Issue.find({}),
        User.countDocuments({ role: ROLES.CUSTOMER }),
        Review.find({}).sort({ createdAt: -1 }).populate("customer", "name").populate({ path: "booking", select: "eventType hall", populate: { path: "hall", select: "name" } }),
        EventGallery.countDocuments({ isPublished: true }),
      ]);

    const byStatus = computeBookingStatusBreakdown(bookings);

    const customerIdsWithBookings = new Set(bookings.filter((b) => b.customer).map((b) => (b.customer._id || b.customer).toString()));

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Balance still owed on bookings that have paid their advance.
    const paidByBooking = new Map();
    payments.forEach((p) => {
      const key = p.booking.toString();
      paidByBooking.set(key, (paidByBooking.get(key) || 0) + p.amount);
    });
    const outstandingBalance = bookings
      .filter((b) => paidByBooking.has(b._id.toString()))
      .reduce((sum, b) => sum + Math.max(0, b.estimatedCost - paidByBooking.get(b._id.toString())), 0);
    const bookedValue = bookings
      .filter((b) => [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.UPCOMING, BOOKING_STATUS.COMPLETED].includes(b.status))
      .reduce((sum, b) => sum + b.estimatedCost, 0);

    // Next events on the calendar (accepted, not yet completed).
    const todayStart = new Date(new Date().toLocaleDateString("en-CA"));
    const upcomingEvents = bookings
      .filter(
        (b) =>
          [BOOKING_STATUS.APPROVED, BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.UPCOMING].includes(b.status) &&
          b.eventDate >= todayStart
      )
      .sort((a, b) => a.eventDate - b.eventDate || a.startTime.localeCompare(b.startTime))
      .slice(0, 8)
      .map((b) => ({
        bookingId: b._id,
        eventType: b.eventType,
        eventDate: b.eventDate,
        startTime: b.startTime,
        endTime: b.endTime,
        hallName: b.hall?.name || null,
        customerName: b.customer?.name || null,
        coordinatorName: b.coordinator?.name || null,
        status: b.status,
        preparationStatus: b.preparationStatus,
      }));

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      ratingBreakdown[r.rating] += 1;
    });
    const reviewSummary = {
      count: reviews.length,
      average: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null,
      ratingBreakdown,
      recent: reviews.slice(0, 5).map((r) => ({
        reviewId: r._id,
        rating: r.rating,
        comment: r.comment,
        customerName: r.customer?.name || null,
        eventType: r.booking?.eventType || null,
        hallName: r.booking?.hall?.name || null,
        bookingId: r.booking?._id || null,
        createdAt: r.createdAt,
      })),
    };

    const openIssues = issues.filter((i) => i.status === ISSUE_STATUS.OPEN).length;

    const hallUsageMap = new Map();
    halls.forEach((h) => hallUsageMap.set(h._id.toString(), { hallId: h._id, hallName: h.name, bookingCount: 0 }));
    bookings.forEach((b) => {
      if (!b.hall) return;
      const key = b.hall._id.toString();
      if (!hallUsageMap.has(key)) {
        hallUsageMap.set(key, { hallId: b.hall._id, hallName: b.hall.name, bookingCount: 0 });
      }
      hallUsageMap.get(key).bookingCount += 1;
    });
    const hallUsage = [...hallUsageMap.values()].sort((a, b) => b.bookingCount - a.bookingCount);

    const managerActivity = {
      pendingReview: byStatus[BOOKING_STATUS.PENDING] || 0,
      approved: bookings.filter(
        (b) => b.status !== BOOKING_STATUS.PENDING && b.status !== BOOKING_STATUS.REJECTED
      ).length,
      rejected: byStatus[BOOKING_STATUS.REJECTED] || 0,
      byManager: computeManagerActivity(managers, bookings),
    };

    const coordinatorActivity = computeCoordinatorActivity(coordinators, bookings, tasks, issues);

    res.json({
      success: true,
      data: {
        bookings: { total: bookings.length, byStatus },
        customers: { totalRegistered: totalCustomers, withBookings: customerIdsWithBookings.size },
        revenue: { totalRevenue, paymentCount: payments.length, outstandingBalance, bookedValue },
        upcomingEvents,
        reviews: reviewSummary,
        issues: { open: openIssues, total: issues.length },
        gallery: { publishedEntries: galleryCount },
        halls: { total: halls.length, active: halls.filter((h) => h.isActive).length },
        hallUsage,
        managerActivity,
        coordinatorActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Owner-only read-only customer directory — reuses User + Booking, no new
// model or customer-management feature.
export const getCustomerDirectory = async (req, res, next) => {
  try {
    const [customers, bookings] = await Promise.all([
      User.find({ role: ROLES.CUSTOMER }).select("name email"),
      Booking.find({}).select("customer"),
    ]);

    const bookingCountByCustomer = new Map();
    bookings.forEach((b) => {
      if (!b.customer) return; // walk-in booking without an account
      const cid = b.customer.toString();
      bookingCountByCustomer.set(cid, (bookingCountByCustomer.get(cid) || 0) + 1);
    });

    const data = customers.map((c) => ({
      customerId: c._id,
      name: c.name,
      email: c.email,
      bookingCount: bookingCountByCustomer.get(c._id.toString()) || 0,
    }));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// Owner-only read-only payment list — reuses Payment + Booking + User, no
// new model or payment feature (creating/recording payments stays in
// payment.controller.js).
export const getPaymentList = async (req, res, next) => {
  try {
    // Checkouts that were opened but never completed (PENDING) aren't payments
    // yet; successful and failed attempts are listed, plus offline payments
    // recorded by staff that are still awaiting confirmation.
    const payments = await Payment.find({
      $or: [{ status: { $ne: PAYMENT_STATUS.PENDING } }, { gateway: PAYMENT_GATEWAY.OFFLINE }],
    })
      .sort({ createdAt: -1 })
      .populate("customer", "name email")
      .populate("confirmedBy", "name")
      .populate({
        path: "booking",
        select: "eventType eventDate hall source walkInCustomer",
        populate: { path: "hall", select: "name" },
      });

    const data = payments.map((p) => ({
      paymentId: p._id,
      booking: p.booking
        ? {
            bookingId: p.booking._id,
            hallName: p.booking.hall?.name || null,
            eventType: p.booking.eventType,
            eventDate: p.booking.eventDate,
            source: p.booking.source || "online",
          }
        : null,
      customer: p.customer
        ? { name: p.customer.name, email: p.customer.email }
        : p.booking?.walkInCustomer
          ? { name: p.booking.walkInCustomer.name, email: p.booking.walkInCustomer.email || "", walkIn: true }
          : null,
      amount: p.amount,
      status: p.status,
      method: p.method,
      gateway: p.gateway,
      transactionId: p.gateway === PAYMENT_GATEWAY.OFFLINE ? p.reference || null : p.transactionId,
      confirmedBy: p.confirmedBy?.name || null,
      paymentDate: p.paidAt || p.createdAt,
    }));

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

// Manager-facing subset of the same underlying data — day-to-day operational
// counts, including a per-coordinator breakdown so the Manager can see the
// whole operational picture without opening every booking individually.
// Deliberately excludes revenue and hall usage, which remain Owner-exclusive
// via getOverview above.
export const getManagerOverview = async (req, res, next) => {
  try {
    const [bookings, payments, tasks, issues, coordinators, offlineAwaitingConfirmation] = await Promise.all([
      Booking.find({}),
      Payment.find({ status: PAYMENT_STATUS.SUCCESS }),
      PreparationTask.find({}),
      Issue.find({}),
      User.find({ role: ROLES.COORDINATOR }).select("name email"),
      Payment.countDocuments({ gateway: PAYMENT_GATEWAY.OFFLINE, status: PAYMENT_STATUS.PENDING }),
    ]);

    const byStatus = computeBookingStatusBreakdown(bookings);

    const paidBookingIds = new Set(payments.map((p) => p.booking.toString()));
    const paymentSummary = {
      awaitingPayment: byStatus[BOOKING_STATUS.APPROVED] || 0,
      // Bookings with any payment received (advance or more) — as before.
      paid: bookings.filter((b) => paidBookingIds.has(b._id.toString())).length,
      partiallyPaid: bookings.filter((b) => b.paymentStatus === BOOKING_PAYMENT_STATUS.PARTIALLY_PAID).length,
      fullyPaid: bookings.filter((b) => b.paymentStatus === BOOKING_PAYMENT_STATUS.PAID).length,
      offlineAwaitingConfirmation,
      walkInBookings: bookings.filter((b) => b.source === "walk_in").length,
    };

    const preparationSummary = Object.fromEntries(ALL_PREPARATION_STATUSES.map((s) => [s, 0]));
    bookings.forEach((b) => {
      preparationSummary[b.preparationStatus] = (preparationSummary[b.preparationStatus] || 0) + 1;
    });

    const taskSummary = Object.fromEntries(ALL_TASK_STATUSES.map((s) => [s, 0]));
    tasks.forEach((t) => {
      taskSummary[t.status] = (taskSummary[t.status] || 0) + 1;
    });

    const openIssuesCount = issues.filter((i) => i.status === ISSUE_STATUS.OPEN).length;
    const resolvedIssuesCount = issues.filter((i) => i.status === ISSUE_STATUS.RESOLVED).length;

    const coordinatorActivity = computeCoordinatorActivity(coordinators, bookings, tasks, issues);

    res.json({
      success: true,
      data: {
        totalBookings: bookings.length,
        pendingBookings: byStatus[BOOKING_STATUS.PENDING] || 0,
        approvedBookings: byStatus[BOOKING_STATUS.APPROVED] || 0,
        upcomingEvents: byStatus[BOOKING_STATUS.UPCOMING] || 0,
        paymentSummary,
        preparationSummary,
        taskSummary,
        openIssuesCount,
        resolvedIssuesCount,
        coordinatorActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};
