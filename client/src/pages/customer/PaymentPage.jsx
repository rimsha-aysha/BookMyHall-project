import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { usePublicSettings } from "../../hooks/usePublicSettings.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { bookingApi } from "../../api/bookingApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import Icon from "../../components/Icon.jsx";
import { ErrorState } from "../../components/States.jsx";
import { PAYMENT_METHOD_LABELS } from "../../constants/payment.js";
import { loadRazorpayCheckout } from "../../utils/razorpayCheckout.js";
import { apiError, formatDate, formatRs, formatTimeRange } from "../../utils/format.js";

// Outcome of the latest checkout attempt (the booking itself is untouched by
// a failed or cancelled attempt — only server-side verification confirms it).
const OUTCOME_MESSAGES = {
  cancelled: {
    tone: "warning",
    title: "Payment cancelled",
    text: "You closed the payment window before paying. Your booking is still approved and waiting for the advance.",
  },
  failed: {
    tone: "danger",
    title: "Payment failed",
    text: "The payment didn't go through and you have not been charged for this attempt.",
  },
  error: {
    tone: "danger",
    title: "Payment not confirmed",
    text: "",
  },
};

const PaymentPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const settings = usePublicSettings();
  const fetchBooking = useCallback(() => bookingApi.getById(id), [id]);
  const { data: booking, loading, error, reload } = useFetch(fetchBooking);
  const fetchSummary = useCallback(() => paymentApi.getForBooking(id), [id]);
  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    reload: reloadSummary,
  } = useFetch(fetchSummary);

  // idle -> starting (creating order) -> checkout (Razorpay open) -> verifying
  const [phase, setPhase] = useState("idle");
  const [outcome, setOutcome] = useState(null);

  const refresh = () => {
    reload();
    reloadSummary();
  };

  const startPayment = async () => {
    setOutcome(null);
    setPhase("starting");
    try {
      const Razorpay = await loadRazorpayCheckout();
      const res = await paymentApi.createOrder(id);
      const order = res.data.data;

      // The server found this booking already paid (e.g. an earlier payment
      // whose confirmation never reached us) — just show the result.
      if (order.alreadyPaid) {
        setPhase("idle");
        refresh();
        return;
      }

      let settled = false;
      let failureReason = "";
      const checkout = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount, // exactly as created by the server, in paise
        currency: order.currency,
        name: settings.businessName,
        description: order.description,
        // Saved account details (phone as +91XXXXXXXXXX), so Checkout can skip its contact form.
        prefill: {
          name: order.customer.name || user?.name,
          email: order.customer.email || user?.email,
          contact: order.customer.contact,
        },
        notes: { bookingId: order.bookingId },
        theme: { color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || undefined },
        handler: async (response) => {
          settled = true;
          setPhase("verifying");
          try {
            await paymentApi.verify(id, response);
            setOutcome(null);
            refresh();
          } catch (err) {
            setOutcome({
              type: "error",
              message: apiError(err, "We couldn't confirm your payment. Please try again."),
            });
          } finally {
            setPhase("idle");
          }
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            setPhase("idle");
            setOutcome(failureReason ? { type: "failed", message: failureReason } : { type: "cancelled" });
          },
        },
      });

      // Checkout stays open after a failure so the customer can retry there;
      // remember why, in case they close it instead.
      checkout.on("payment.failed", (response) => {
        failureReason = response.error?.description || "Payment failed";
        paymentApi.reportFailure(id, order.orderId, failureReason).catch(() => {});
      });

      setPhase("checkout");
      checkout.open();
    } catch (err) {
      setPhase("idle");
      setOutcome({ type: "error", message: apiError(err, "Could not start the payment. Please try again.") });
    }
  };

  const isLoading = loading || summaryLoading;
  const busy = phase !== "idle";
  // Once the advance is in (online and/or paid at the venue) the booking is
  // no longer awaiting payment; until then only the rest of it is due here.
  const paid = booking && summary && booking.status !== "approved" && summary.totalPaid > 0 ? summary.payment : null;
  const due = summary ? summary.advanceDue ?? summary.advanceAmount : 0;
  const outcomeInfo = outcome && OUTCOME_MESSAGES[outcome.type];

  return (
    <div>
      <Link to={`/my-bookings/${id}`} className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> Back to booking
      </Link>

      {isLoading && (
        <div className="detail-layout">
          <div className="card skeleton" />
          <div className="card skeleton" />
        </div>
      )}
      {!isLoading && (error || summaryError) && <ErrorState message={error || summaryError} onRetry={refresh} />}

      {!isLoading && !error && !summaryError && booking && summary && (
        <>
          <div className="page-head">
            <p className="eyebrow">Payment</p>
            <div className="title-row">
              <h1>{paid ? "Payment received" : "Pay your advance"}</h1>
              <StatusBadge status={booking.status} />
            </div>
          </div>

          <div className="detail-layout">
            <section className="card card-body">
              <h2>Booking summary</h2>
              <dl className="facts">
                <div>
                  <dt>Event</dt>
                  <dd>{booking.eventType}</dd>
                </div>
                <div>
                  <dt>Hall</dt>
                  <dd>{booking.hall?.name}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{formatDate(booking.eventDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{formatTimeRange(booking.startTime, booking.endTime)}</dd>
                </div>
                <div>
                  <dt>Guests</dt>
                  <dd>{booking.guestCount}</dd>
                </div>
              </dl>
              <dl className="cost-lines">
                <div>
                  <dt>Total cost</dt>
                  <dd>{formatRs(summary.totalCost)}</dd>
                </div>
                <div>
                  <dt>Advance ({summary.advancePercentage}%)</dt>
                  <dd>{formatRs(summary.advanceAmount)}</dd>
                </div>
              </dl>
            </section>

            <aside className="detail-side card">
              <div className="card-body">
                {paid ? (
                  <>
                    <div className="success-icon" aria-hidden="true">
                      <Icon name="check" size={28} />
                    </div>
                    <h2 className="center">Payment Successful</h2>
                    <dl className="facts">
                      <div>
                        <dt>Booking ID</dt>
                        <dd className="mono small">{booking._id}</dd>
                      </div>
                      <div>
                        <dt>Amount paid</dt>
                        <dd>{formatRs(paid.amount)}</dd>
                      </div>
                      {(paid.razorpayPaymentId || paid.transactionId) && (
                        <div>
                          <dt>{paid.gateway === "razorpay" ? "Razorpay payment ID" : "Reference"}</dt>
                          <dd className="mono small">{paid.razorpayPaymentId || paid.transactionId}</dd>
                        </div>
                      )}
                      {summary.totalPaid !== paid.amount && (
                        <div>
                          <dt>Total paid</dt>
                          <dd>{formatRs(summary.totalPaid)}</dd>
                        </div>
                      )}
                      {paid.method && (
                        <div>
                          <dt>Method</dt>
                          <dd>{PAYMENT_METHOD_LABELS[paid.method] || paid.method}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Payment status</dt>
                        <dd>
                          <span className="badge badge-success">Success</span>
                        </dd>
                      </div>
                      <div>
                        <dt>Booking status</dt>
                        <dd>
                          <StatusBadge status={booking.status} />
                        </dd>
                      </div>
                      <div>
                        <dt>Remaining balance</dt>
                        <dd>{formatRs(summary.remainingBalance)}</dd>
                      </div>
                    </dl>
                    <Link to={`/my-bookings/${id}`} className="button-link block">
                      View booking
                    </Link>
                  </>
                ) : booking.status === "approved" ? (
                  <>
                    <h2>Advance due</h2>
                    <p className="price price-xl">{formatRs(due)}</p>
                    <p className="muted small">
                      {summary.advancePercentage}% of {formatRs(summary.totalCost)} — paying confirms your date.
                      {summary.totalPaid > 0 && ` ${formatRs(summary.totalPaid)} has already been received.`}
                    </p>

                    {!user?.phone && (
                      <div className="notice notice-warning mt-8" role="status">
                        <strong>Phone number needed</strong>
                        <span className="small">Please add your phone number to your profile before making a payment.</span>
                        <Link to="/account" state={{ from: `/my-bookings/${id}/pay` }} className="button-link button-sm">
                          Add phone number in your profile
                        </Link>
                      </div>
                    )}

                    {outcomeInfo && (
                      <div className={`notice notice-${outcomeInfo.tone} mt-8`} role="alert">
                        <strong>{outcomeInfo.title}</strong>
                        <span className="small">{outcome.message || outcomeInfo.text}</span>
                      </div>
                    )}

                    <button type="button" className="block" disabled={busy || !user?.phone} onClick={startPayment}>
                      <Icon name={outcome ? "refresh" : "card"} size={16} />
                      {phase === "starting"
                        ? "Opening secure checkout…"
                        : phase === "checkout"
                          ? "Complete payment in the Razorpay window…"
                          : phase === "verifying"
                            ? "Confirming your payment…"
                            : outcome
                              ? "Try again"
                              : `Pay ${formatRs(due)}`}
                    </button>
                    <p className="muted small center">
                      Secure payment by Razorpay (test mode) — card, UPI, netbanking or wallet.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>No payment due</h2>
                    <p className="muted">This booking is not awaiting payment.</p>
                    <Link to={`/my-bookings/${id}`} className="button-link block">
                      View booking
                    </Link>
                  </>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
};

export default PaymentPage;
