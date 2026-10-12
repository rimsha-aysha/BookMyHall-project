import { useFetch } from "../../hooks/useFetch.js";
import { reportApi } from "../../api/reportApi.js";
import PageHeader from "../../components/PageHeader.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";
import { formatDate, formatRs } from "../../utils/format.js";
import { PAYMENT_METHOD_LABELS, PAYMENT_GATEWAY_LABELS, paymentRecordStatus } from "../../constants/payment.js";

const PaymentDirectory = () => {
  const { data: payments, loading, error, reload } = useFetch(reportApi.getPaymentList);
  const total = (payments || []).filter((p) => p.status === "success").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Payments"
        lead="All payments for bookings — online (Razorpay) and offline (cash, UPI, bank transfer) recorded by staff."
        actions={payments?.length > 0 && <span className="badge badge-success">Received {formatRs(total)}</span>}
      />

      {loading && <LoadingState variant="list" count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (!payments || payments.length === 0) && (
        <EmptyState icon="card" title="No payments yet" message="Payments will be listed here." />
      )}
      {!loading && !error && payments?.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Method</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.paymentId}>
                <td data-label="Booking">
                  {p.booking ? (
                    <span className="table-title">
                      <strong>
                        {p.booking.eventType} · {p.booking.hallName || "Unknown hall"}
                      </strong>
                      <span className="muted small">Event {formatDate(p.booking.eventDate)}</span>
                    </span>
                  ) : (
                    <span className="muted">Booking deleted</span>
                  )}
                </td>
                <td data-label="Customer">
                  {p.customer ? (
                    <span className="table-title">
                      {p.customer.name}
                      <span className="muted small">{p.customer.walkIn ? "Walk-in customer" : p.customer.email}</span>
                    </span>
                  ) : (
                    "Unknown"
                  )}
                </td>
                <td data-label="Amount">
                  <span className="price">{formatRs(p.amount)}</span>
                </td>
                <td data-label="Status">
                  <span className={`badge badge-${paymentRecordStatus(p).tone}`}>{paymentRecordStatus(p).label}</span>
                  {p.confirmedBy && <span className="muted small"> by {p.confirmedBy}</span>}
                </td>
                <td data-label="Method">
                  <span className="table-title">
                    {PAYMENT_METHOD_LABELS[p.method] || p.method || "—"}
                    <span className="muted small">
                      {PAYMENT_GATEWAY_LABELS[p.gateway || "mock"] || p.gateway}
                      {p.gateway === "offline" && p.transactionId && ` · Ref ${p.transactionId}`}
                    </span>
                  </span>
                </td>
                <td data-label="Date">{new Date(p.paymentDate).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PaymentDirectory;
