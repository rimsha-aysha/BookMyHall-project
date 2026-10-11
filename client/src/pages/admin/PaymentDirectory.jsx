import { useFetch } from "../../hooks/useFetch.js";
import { reportApi } from "../../api/reportApi.js";
import PageHeader from "../../components/PageHeader.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";
import { formatDate, formatRs } from "../../utils/format.js";
import { PAYMENT_METHOD_LABELS } from "../../constants/payment.js";

const PAYMENT_STATUS_LABELS = {
  success: "Success",
  failed: "Failed",
};

const PaymentDirectory = () => {
  const { data: payments, loading, error, reload } = useFetch(reportApi.getPaymentList);
  const total = (payments || []).filter((p) => p.status === "success").reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Payments"
        lead="All advance payments received for bookings."
        actions={payments?.length > 0 && <span className="badge badge-success">Received {formatRs(total)}</span>}
      />

      {loading && <LoadingState variant="list" count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (!payments || payments.length === 0) && (
        <EmptyState icon="card" title="No payments yet" message="Advance payments will be listed here." />
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
                      <span className="muted small">{p.customer.email}</span>
                    </span>
                  ) : (
                    "Unknown"
                  )}
                </td>
                <td data-label="Amount">
                  <span className="price">{formatRs(p.amount)}</span>
                </td>
                <td data-label="Status">
                  <span className={`badge ${p.status === "success" ? "badge-success" : "badge-danger"}`}>
                    {PAYMENT_STATUS_LABELS[p.status] || p.status}
                  </span>
                </td>
                <td data-label="Method">
                  <span className="table-title">
                    {PAYMENT_METHOD_LABELS[p.method] || p.method || "—"}
                    <span className="muted small">{p.gateway === "razorpay" ? "Razorpay (test)" : "Mock"}</span>
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
