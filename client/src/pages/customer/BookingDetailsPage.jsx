import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import { reviewApi } from "../../api/reviewApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { StatusBadge, BookingTimeline } from "../../components/BookingStatus.jsx";
import { formatRs, formatDate, formatTimeRange, apiError } from "../../utils/format.js";
import Icon from "../../components/Icon.jsx";
import { ErrorState } from "../../components/States.jsx";
import { PAYMENT_METHOD_LABELS } from "../../constants/payment.js";

const PREPARATION_STATUS_LABELS = {
  not_started: "Not started yet",
  in_progress: "In progress",
  completed: "Completed — all set!",
};

const NamedList = ({ items }) => {
  if (!items || items.length === 0) return <p className="muted">None selected.</p>;
  return (
    <dl className="cost-lines compact">
      {items.map((item) => (
        <div key={item._id}>
          <dt>{item.name}</dt>
          <dd>{formatRs(item.price)}</dd>
        </div>
      ))}
    </dl>
  );
};

const RATING_LABELS = { 5: "Excellent", 4: "Good", 3: "Average", 2: "Poor", 1: "Very Poor" };

const ReviewSection = ({ bookingId, review, loading, error, onSubmitted }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await reviewApi.create(bookingId, { rating: Number(rating), comment });
      onSubmitted();
    } catch (err) {
      setFormError(apiError(err, "Could not submit review"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card card-body section">
      <h2>Your Review</h2>
      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && review && (
        <>
          <p className="stars large" aria-label={`${review.rating} out of 5`}>
            {"★".repeat(review.rating)}
            <span className="stars-empty">{"★".repeat(5 - review.rating)}</span>
          </p>
          {review.comment && <p>“{review.comment}”</p>}
          <p className="muted small">Thank you for sharing your experience!</p>
        </>
      )}

      {!loading && !error && !review && (
        <form onSubmit={handleSubmit}>
          <p className="muted">How was your event? Your feedback helps future customers choose.</p>
          <div>
            <span className="field-label" id="rating-label">
              Rating
            </span>
            <div className="star-picker" role="radiogroup" aria-labelledby="rating-label">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} - ${RATING_LABELS[n]}`}
                  className={n <= rating ? "on" : ""}
                  onClick={() => setRating(n)}
                >
                  ★
                </button>
              ))}
              <span className="muted small">{RATING_LABELS[rating]}</span>
            </div>
          </div>
          <div>
            <label htmlFor="comment">Comment</label>
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {formError && <p role="alert">{formError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      )}
    </section>
  );
};

const NEXT_STEP = {
  pending: "Your request is with the manager. You'll be able to pay the advance once it's approved.",
  approved: "Approved! Pay the advance to confirm your date.",
  confirmed: "Confirmed — your advance is received. A coordinator will prepare your event.",
  upcoming: "Your event is coming up. Your coordinator is finalising preparations.",
  completed: "We hope you enjoyed your event! Please leave a review.",
  rejected: "Unfortunately this request was not approved. You can try another date or hall.",
};

const BookingDetailsPage = () => {
  const { id } = useParams();
  const fetchBooking = useCallback(() => bookingApi.getById(id), [id]);
  const { data: booking, loading, error, reload } = useFetch(fetchBooking);
  const fetchPayment = useCallback(() => paymentApi.getForBooking(id), [id]);
  const { data: payment } = useFetch(fetchPayment);
  const fetchReview = useCallback(() => reviewApi.getForBooking(id), [id]);
  const { data: review, loading: reviewLoading, error: reviewError, reload: reloadReview } = useFetch(fetchReview);

  return (
    <div>
      <Link to="/my-bookings" className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> My bookings
      </Link>

      {loading && <div className="card skeleton skeleton-tall" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && booking && (
        <>
          <div className="page-head">
            <div className="title-row">
              <h1>
                {booking.eventType} at {booking.hall?.name}
              </h1>
              <StatusBadge status={booking.status} />
            </div>
            <div className="card-meta large">
              <span>
                <Icon name="calendar" size={16} />{" "}
                {formatDate(booking.eventDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span>
                <Icon name="clock" size={16} /> {formatTimeRange(booking.startTime, booking.endTime)}
              </span>
              <span>
                <Icon name="users" size={16} /> {booking.guestCount} guests
              </span>
            </div>
          </div>

          <section className="card card-body section">
            <BookingTimeline status={booking.status} hasReview={Boolean(review)} />
            <p className="next-step">{NEXT_STEP[booking.status]}</p>
            {booking.status === "approved" && (
              <Link to={`/my-bookings/${booking._id}/pay`} className="button-link button-primary">
                Pay Now{payment ? ` — ${formatRs(payment.advanceDue ?? payment.advanceAmount)} advance` : ""}
              </Link>
            )}
            {booking.status === "rejected" && (
              <Link to="/booking" className="button-link">
                Start a new booking
              </Link>
            )}
          </section>

          <div className="two-col">
            <section className="card card-body">
              <h2>Your selections</h2>
              <p>
                <strong>Hall:</strong>{" "}
                {booking.hall ? <Link to={`/halls/${booking.hall._id}`}>{booking.hall.name}</Link> : "—"} ·{" "}
                {formatRs(booking.hall?.price)}
              </p>
              <p>
                <strong>Package:</strong> {booking.package ? `${booking.package.name} · ${formatRs(booking.package.price)}` : "None"}
              </p>
              <p>
                <strong>Requirements:</strong> {booking.requirements || "None"}
              </p>
              <h3>Food</h3>
              <NamedList items={booking.food} />
              <h3>Decorations</h3>
              <NamedList items={booking.decorations} />
              <h3>Additional Services</h3>
              <NamedList items={booking.services} />
              <dl className="cost-lines">
                <div className="cost-total">
                  <dt>Estimated Cost</dt>
                  <dd>{formatRs(booking.estimatedCost)}</dd>
                </div>
              </dl>
            </section>

            <div className="stack">
              <section className="card card-body">
                <h2>Payment</h2>
                {!payment && <p className="muted">Loading payment details...</p>}
                {payment && (
                  <dl className="cost-lines">
                    <div>
                      <dt>Total cost</dt>
                      <dd>{formatRs(payment.totalCost)}</dd>
                    </div>
                    <div>
                      <dt>Advance ({payment.advancePercentage}%)</dt>
                      <dd>{formatRs(payment.advanceAmount)}</dd>
                    </div>
                    <div>
                      <dt>Payment status</dt>
                      <dd>
                        {payment.paymentStatus === "paid" ? (
                          <span className="badge badge-success">Fully paid</span>
                        ) : payment.totalPaid > 0 && payment.advanceDue === 0 ? (
                          <span className="badge badge-success">Advance paid</span>
                        ) : payment.totalPaid > 0 ? (
                          <span className="badge badge-warning">Part of advance received</span>
                        ) : booking.status === "approved" ? (
                          <span className="badge badge-warning">Due now</span>
                        ) : booking.status === "pending" ? (
                          <span className="badge badge-neutral">After approval</span>
                        ) : (
                          <span className="badge badge-neutral">Not applicable</span>
                        )}
                      </dd>
                    </div>
                    {(payment.payments || []).map((p) => (
                      <div key={p._id}>
                        <dt>
                          {formatDate(p.paidAt || p.createdAt)} ·{" "}
                          {p.gateway === "offline" ? "Paid at venue" : "Paid online"}
                          {p.method && ` (${PAYMENT_METHOD_LABELS[p.method] || p.method})`}
                          {p.transactionId && <span className="mono small"> · {p.transactionId}</span>}
                        </dt>
                        <dd>{formatRs(p.amount)}</dd>
                      </div>
                    ))}
                    {payment.totalPaid > 0 && (
                      <div>
                        <dt>Total paid</dt>
                        <dd>{formatRs(payment.totalPaid)}</dd>
                      </div>
                    )}
                    <div className="cost-total">
                      <dt>Remaining balance</dt>
                      <dd>{formatRs(payment.remainingBalance)}</dd>
                    </div>
                  </dl>
                )}
              </section>

              <section className="card card-body">
                <h2>Event preparation</h2>
                <p>
                  <strong>Coordinator:</strong> {booking.coordinator?.name || "Not assigned yet"}
                </p>
                <p>
                  <strong>Progress:</strong> {PREPARATION_STATUS_LABELS[booking.preparationStatus] || booking.preparationStatus}
                </p>
              </section>
            </div>
          </div>

          {booking.status === "completed" && (
            <ReviewSection
              bookingId={booking._id}
              review={review}
              loading={reviewLoading}
              error={reviewError}
              onSubmitted={reloadReview}
            />
          )}
        </>
      )}
    </div>
  );
};

export default BookingDetailsPage;
