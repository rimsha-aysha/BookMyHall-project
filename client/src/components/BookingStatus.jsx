// Booking status badge + lifecycle timeline, shared by the customer pages,
// plus the payment-status and walk-in badges used on staff pages.
import { STATUS_TONE } from "../constants/bookingStatus.js";
import { BOOKING_PAYMENT_STATUS_LABELS, BOOKING_PAYMENT_STATUS_TONE } from "../constants/payment.js";

const BOOKING_STATUS_LABELS = {
  pending: "Awaiting Approval",
  approved: "Approved — Payment Due",
  rejected: "Rejected",
  payment_pending: "Payment Pending",
  confirmed: "Confirmed",
  upcoming: "Upcoming",
  completed: "Completed",
};

export const StatusBadge = ({ status }) => (
  <span className={`badge badge-${STATUS_TONE[status] || "neutral"}`}>
    {BOOKING_STATUS_LABELS[status] || status}
  </span>
);

// Unpaid / Partially paid / Fully paid. Bookings saved before payment status
// existed are filled in by the server, so a missing value just means unpaid.
export const PaymentStatusBadge = ({ status }) => {
  const key = status || "unpaid";
  return (
    <span className={`badge badge-${BOOKING_PAYMENT_STATUS_TONE[key] || "neutral"}`}>
      {BOOKING_PAYMENT_STATUS_LABELS[key] || key}
    </span>
  );
};

// Shown only for bookings staff entered for a customer at the venue.
export const WalkInBadge = ({ source }) =>
  source === "walk_in" ? (
    <span className="badge badge-info" title="Booked in person at the venue">
      Walk-in
    </span>
  ) : null;

const STEPS = [
  { key: "pending", label: "Requested", hint: "Sent to the manager" },
  { key: "approved", label: "Approved", hint: "Manager accepted" },
  { key: "confirmed", label: "Advance Paid", hint: "Booking confirmed" },
  { key: "upcoming", label: "Preparation", hint: "Coordinator preparing" },
  { key: "completed", label: "Completed", hint: "Event held" },
  { key: "reviewed", label: "Reviewed", hint: "Thanks for the feedback" },
];

// How many STEPS are finished for each status; the next step is "current".
const STEPS_DONE = { pending: 1, approved: 2, payment_pending: 2, confirmed: 3, upcoming: 3, completed: 5 };

export const BookingTimeline = ({ status, hasReview }) => {
  if (status === "rejected") {
    return (
      <ol className="timeline">
        <li className="done">
          <span className="timeline-dot">✓</span>
          <span className="timeline-label">Requested</span>
        </li>
        <li className="failed">
          <span className="timeline-dot">✕</span>
          <span className="timeline-label">Rejected</span>
          <span className="timeline-hint">The manager couldn't accept this request</span>
        </li>
      </ol>
    );
  }

  const done = hasReview ? STEPS.length : STEPS_DONE[status] ?? 0;
  return (
    <ol className="timeline">
      {STEPS.map((step, i) => {
        const state = i < done ? "done" : i === done ? "current" : "";
        return (
          <li key={step.key} className={state}>
            <span className="timeline-dot">{state === "done" ? "✓" : i + 1}</span>
            <span className="timeline-label">{step.label}</span>
            <span className="timeline-hint">{step.hint}</span>
          </li>
        );
      })}
    </ol>
  );
};
