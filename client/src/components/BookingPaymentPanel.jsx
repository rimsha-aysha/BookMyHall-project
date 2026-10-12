import { useState } from "react";
import { paymentApi } from "../api/paymentApi.js";
import Icon from "./Icon.jsx";
import { PaymentStatusBadge } from "./BookingStatus.jsx";
import { apiError, formatDate, formatRs, todayInputValue } from "../utils/format.js";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_GATEWAY_LABELS,
  OFFLINE_PAYMENT_METHODS,
  REFERENCE_REQUIRED_METHODS,
  paymentRecordStatus,
} from "../constants/payment.js";

// Same rule as the API: payments are taken once a booking is approved.
const PAYABLE_STATUSES = ["approved", "confirmed", "upcoming", "completed"];

// One id per form submission attempt, so a double-click or a retried request
// can't record the same payment twice (the server rejects a reused id).
const newSubmissionId = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const emptyForm = (suggested) => ({
  amount: suggested > 0 ? String(suggested) : "",
  method: "cash",
  paymentDate: todayInputValue(),
  reference: "",
  notes: "",
  confirmReceived: false,
});

const PaymentHistory = ({ payments, canRecord, busyId, onConfirm, onCancel }) => {
  if (!payments.length) return <p className="muted">No payments yet.</p>;
  return (
    <ul className="payment-history">
      {payments.map((p) => {
        const state = paymentRecordStatus(p);
        const offline = p.gateway === "offline";
        const pending = offline && p.status === "pending";
        const reference = offline ? p.reference : p.razorpayPaymentId || p.transactionId;
        return (
          <li key={p._id} className={pending ? "is-pending" : offline && p.status === "failed" ? "is-cancelled" : ""}>
            <div className="payment-line">
              <strong className="price">{formatRs(p.amount)}</strong>
              <span className={`badge badge-${state.tone}`}>{state.label}</span>
            </div>
            <span className="small">
              {PAYMENT_GATEWAY_LABELS[p.gateway || "mock"] || p.gateway}
              {p.method && <> · {PAYMENT_METHOD_LABELS[p.method] || p.method}</>}
              {" · "}
              {p.paidAt || p.createdAt ? formatDate(p.paidAt || p.createdAt) : "—"}
            </span>
            {reference && <span className="mono small">Ref: {reference}</span>}
            {offline && (
              <span className="muted small">
                Recorded by {p.recordedBy?.name || "—"}
                {p.recordedAt && ` on ${new Date(p.recordedAt).toLocaleString()}`}
                {p.confirmedBy && (
                  <>
                    <br />
                    Confirmed received by {p.confirmedBy.name} on {new Date(p.confirmedAt).toLocaleString()}
                  </>
                )}
                {p.status === "failed" && (
                  <>
                    <br />
                    Cancelled{p.cancelledBy ? ` by ${p.cancelledBy.name}` : ""}
                    {p.failureReason ? ` — ${p.failureReason}` : ""}
                  </>
                )}
              </span>
            )}
            {offline && p.notes && <span className="small">Note: {p.notes}</span>}
            {!offline && p.status === "failed" && p.failureReason && (
              <span className="muted small">Checkout failed: {p.failureReason}</span>
            )}
            {pending && canRecord && (
              <div className="button-row">
                <button
                  type="button"
                  className="button-sm button-primary"
                  disabled={busyId === p._id}
                  onClick={() => onConfirm(p)}
                >
                  <Icon name="check" size={14} /> Confirm payment received
                </button>
                <button type="button" className="button-sm" disabled={busyId === p._id} onClick={() => onCancel(p)}>
                  <Icon name="x" size={14} /> Cancel record
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

// Manager/Owner payment panel on a booking: totals, payment history (online
// and offline), confirming recorded offline payments, and recording a new
// offline payment. Every rule is enforced again by the API.
const BookingPaymentPanel = ({ booking, summary, canRecord, onChanged }) => {
  const recordable = summary ? Math.max(0, summary.remainingBalance - (summary.pendingOfflineAmount || 0)) : 0;
  const suggested = summary ? Math.min(summary.advanceDue > 0 ? summary.advanceDue : recordable, recordable) : 0;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyForm(suggested));
  const [submissionId, setSubmissionId] = useState(newSubmissionId);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!summary) return <p className="muted">Loading payment details…</p>;

  const payable = PAYABLE_STATUSES.includes(booking.status);
  const referenceRequired = REFERENCE_REQUIRED_METHODS.includes(form.method);
  const paidPercent = summary.totalCost > 0 ? Math.min(100, Math.round((summary.totalPaid / summary.totalCost) * 100)) : 0;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const openForm = () => {
    setForm(emptyForm(suggested));
    setSubmissionId(newSubmissionId());
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const handleRecord = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < 1) {
      setError("Enter the amount received in whole rupees.");
      return;
    }
    if (amount > recordable) {
      setError(`Amount can't be more than ${formatRs(recordable)} (the outstanding balance not yet recorded).`);
      return;
    }
    if (
      form.confirmReceived &&
      !window.confirm(
        `Confirm that ${formatRs(amount)} (${PAYMENT_METHOD_LABELS[form.method]}) has actually been received and verified?`
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await paymentApi.recordOffline(booking._id, {
        amount,
        method: form.method,
        paymentDate: form.paymentDate,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        confirmReceived: form.confirmReceived,
        idempotencyKey: submissionId,
      });
      setMessage(
        form.confirmReceived
          ? `${formatRs(amount)} recorded and confirmed as received.`
          : `${formatRs(amount)} recorded — confirm it once the money is verified.`
      );
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(apiError(err, "Could not record the payment"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (payment) => {
    if (
      !window.confirm(
        `Confirm that ${formatRs(payment.amount)} (${PAYMENT_METHOD_LABELS[payment.method] || payment.method}) has actually been received and verified? This can't be undone.`
      )
    ) {
      return;
    }
    setError("");
    setMessage("");
    setBusyId(payment._id);
    try {
      await paymentApi.confirmOffline(payment._id);
      setMessage(`${formatRs(payment.amount)} confirmed as received.`);
      onChanged();
    } catch (err) {
      setError(apiError(err, "Could not confirm the payment"));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (payment) => {
    const reason = window.prompt("Why is this payment record being cancelled? (kept in the payment history)", "");
    if (reason === null) return;
    setError("");
    setMessage("");
    setBusyId(payment._id);
    try {
      await paymentApi.cancelOffline(payment._id, reason.trim() || undefined);
      setMessage("Payment record cancelled.");
      onChanged();
    } catch (err) {
      setError(apiError(err, "Could not cancel the payment record"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="title-row mb-8">
        <PaymentStatusBadge status={summary.paymentStatus} />
        {summary.pendingOfflineAmount > 0 && (
          <span className="badge badge-warning">{formatRs(summary.pendingOfflineAmount)} awaiting confirmation</span>
        )}
      </div>

      <dl className="payment-totals">
        <div>
          <dt>Total cost</dt>
          <dd>{formatRs(summary.totalCost)}</dd>
        </div>
        <div>
          <dt>Total paid</dt>
          <dd>{formatRs(summary.totalPaid)}</dd>
        </div>
        <div className={summary.remainingBalance > 0 ? "is-due" : "is-clear"}>
          <dt>Outstanding</dt>
          <dd>{formatRs(summary.remainingBalance)}</dd>
        </div>
        <div className={summary.advanceDue > 0 ? "is-due" : "is-clear"}>
          <dt>Advance ({summary.advancePercentage}%)</dt>
          <dd>{summary.advanceDue > 0 ? `${formatRs(summary.advanceDue)} due` : "Received"}</dd>
        </div>
      </dl>
      <span
        className="meter payment-meter"
        role="img"
        aria-label={`${paidPercent}% of the total paid`}
        title={`${paidPercent}% paid`}
      >
        <span style={{ width: `${paidPercent}%` }} />
      </span>

      {message && (
        <div className="notice notice-success" role="status">
          <span className="small">{message}</span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}

      <h3>Payment history</h3>
      <PaymentHistory
        payments={summary.payments || []}
        canRecord={canRecord}
        busyId={busyId}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {canRecord && payable && recordable > 0 && !showForm && (
        <button type="button" className="button-primary mt-8" onClick={openForm}>
          <Icon name="card" size={16} /> Record offline payment
        </button>
      )}
      {canRecord && !payable && booking.status === "pending" && (
        <p className="muted small mt-8">Approve the booking before recording a payment.</p>
      )}
      {canRecord && payable && recordable <= 0 && summary.remainingBalance > 0 && (
        <p className="muted small mt-8">
          The rest of the balance is already recorded — confirm or cancel the records awaiting confirmation.
        </p>
      )}

      {showForm && (
        <form className="offline-form" onSubmit={handleRecord}>
          <h3>Record offline payment</h3>
          <p className="muted small">
            For money received outside online checkout — at the venue or by direct transfer. Up to{" "}
            {formatRs(recordable)} can be recorded.
          </p>
          <div className="form-row">
            <div>
              <label htmlFor="offline-amount">Amount received (Rs.)</label>
              <input
                id="offline-amount"
                name="amount"
                type="number"
                inputMode="numeric"
                min="1"
                max={recordable}
                step="1"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label htmlFor="offline-method">Payment method</label>
              <select id="offline-method" name="method" value={form.method} onChange={handleChange} required>
                {OFFLINE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="offline-date">Payment date</label>
              <input
                id="offline-date"
                name="paymentDate"
                type="date"
                max={todayInputValue()}
                value={form.paymentDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="offline-reference">
              Transaction reference / UTR {referenceRequired ? "" : "(optional)"}
            </label>
            <input
              id="offline-reference"
              name="reference"
              type="text"
              autoComplete="off"
              maxLength={64}
              placeholder={form.method === "cash" ? "Receipt number, if any" : "e.g. UTR or UPI reference number"}
              value={form.reference}
              onChange={handleChange}
              required={referenceRequired}
            />
            <p className="field-help">
              Never enter UPI PINs, card numbers, passwords or bank login details — only the reference shown on the
              receipt or bank statement.
            </p>
          </div>
          <div>
            <label htmlFor="offline-notes">Notes (optional)</label>
            <textarea
              id="offline-notes"
              name="notes"
              maxLength={500}
              placeholder="e.g. Paid by the customer's brother at the front desk"
              value={form.notes}
              onChange={handleChange}
            />
          </div>
          <label className="inline-check">
            <input type="checkbox" name="confirmReceived" checked={form.confirmReceived} onChange={handleChange} />
            I have received and verified this money — confirm it now
          </label>
          <p className="field-help">
            Leave unticked to record it as awaiting confirmation (e.g. a transfer not yet visible in the bank account).
            Only confirmed payments count towards the amount paid.
          </p>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? "Saving…" : form.confirmReceived ? "Record & confirm payment" : "Record payment"}
            </button>
            <button type="button" disabled={submitting} onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
};

export default BookingPaymentPanel;
