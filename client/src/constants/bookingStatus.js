// Badge colour tone per booking status (see .badge-* / .tone-* in components.css).
export const STATUS_TONE = Object.freeze({
  pending: "warning",
  approved: "accent",
  rejected: "danger",
  payment_pending: "warning",
  confirmed: "success",
  upcoming: "info",
  completed: "neutral",
});

// Short staff-facing status names and a glyph per status, so calendars and
// lists don't rely on colour alone.
export const STAFF_STATUS_LABELS = Object.freeze({
  pending: "Pending approval",
  approved: "Approved — payment due",
  rejected: "Rejected",
  payment_pending: "Payment pending",
  confirmed: "Confirmed",
  upcoming: "Upcoming",
  completed: "Completed",
});

export const STATUS_GLYPH = Object.freeze({
  pending: "○",
  approved: "◐",
  payment_pending: "◐",
  confirmed: "●",
  upcoming: "●",
  completed: "✓",
  rejected: "✕",
});
