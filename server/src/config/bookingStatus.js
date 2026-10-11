// The documented booking lifecycle. Only PENDING is used by this step —
// the rest exist so later steps (manager approval, payment, coordinator
// workflow) don't need schema changes.
export const BOOKING_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAYMENT_PENDING: "payment_pending",
  CONFIRMED: "confirmed",
  UPCOMING: "upcoming",
  COMPLETED: "completed",
});

export const ALL_BOOKING_STATUSES = Object.values(BOOKING_STATUS);

// Statuses that do NOT hold a hall's time slot. Every other status blocks
// the slot (overlapping requests are refused) — including PENDING, so a
// request awaiting manager review can't be double-booked underneath it.
// COMPLETED bookings sit on past dates, so they never block future dates.
// Used by the double-booking check and the availability calendar alike.
export const NON_BLOCKING_BOOKING_STATUSES = Object.freeze([BOOKING_STATUS.REJECTED]);
