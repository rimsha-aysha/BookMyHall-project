import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { listCoordinators } from "../../api/authApi.js";
import { taskApi } from "../../api/taskApi.js";
import { issueApi } from "../../api/issueApi.js";
import { reviewApi } from "../../api/reviewApi.js";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import Icon from "../../components/Icon.jsx";
import { ErrorState } from "../../components/States.jsx";
import { apiError, formatDate, formatRs, formatTimeRange } from "../../utils/format.js";
import { PAYMENT_METHOD_LABELS } from "../../constants/payment.js";
import { formatPhone } from "../../utils/phone.js";

const NamedList = ({ items }) => {
  if (!items || items.length === 0) return <p className="muted small">None selected.</p>;
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

const TASK_STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const TASK_STATUS_TONE = { pending: "neutral", in_progress: "warning", completed: "success" };

const TASK_CATEGORY_LABELS = {
  hall_setup: "Hall Setup",
  food: "Food",
  decorations: "Decorations",
  additional_services: "Additional Services",
  customer_requirements: "Customer Requirements",
};

const ISSUE_STATUS_LABELS = {
  open: "Open",
  resolved: "Resolved",
};

const PREPARATION_STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};


// Same rule as the API: preparation starts once the advance is paid.
const COORDINATOR_ASSIGNABLE = ["confirmed", "upcoming"];

// The event date has arrived (today or earlier) — required before completion.
const eventDateReached = (eventDate) =>
  new Date(eventDate).toISOString().slice(0, 10) <= new Date().toLocaleDateString("en-CA");

const ManagerBookingDetails = () => {
  const { id } = useParams();
  const fetchBooking = useCallback(() => bookingApi.getById(id), [id]);
  const { data: booking, loading, error, reload } = useFetch(fetchBooking);
  const fetchPayment = useCallback(() => paymentApi.getForBooking(id), [id]);
  const { data: paymentSummary } = useFetch(fetchPayment);
  const { data: coordinators } = useFetch(listCoordinators);
  const fetchTasks = useCallback(() => taskApi.listForBooking(id), [id]);
  const { data: tasks, loading: tasksLoading, error: tasksError } = useFetch(fetchTasks);
  const fetchIssues = useCallback(() => issueApi.listForBooking(id), [id]);
  const {
    data: issues,
    loading: issuesLoading,
    error: issuesError,
    reload: reloadIssues,
  } = useFetch(fetchIssues);
  const fetchReview = useCallback(() => reviewApi.getForBooking(id), [id]);
  const { data: review } = useFetch(fetchReview);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState("");

  useEffect(() => {
    if (booking?.coordinator?._id) {
      setSelectedCoordinatorId(booking.coordinator._id);
    }
  }, [booking?.coordinator?._id]);

  const handleDecision = async (status) => {
    setActionError("");
    setSubmitting(true);
    try {
      await bookingApi.updateStatus(id, status);
      reload();
    } catch (err) {
      setActionError(apiError(err, "Action failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignCoordinator = async (e) => {
    e.preventDefault();
    setActionError("");
    setSubmitting(true);
    try {
      await bookingApi.assignCoordinator(id, selectedCoordinatorId);
      reload();
    } catch (err) {
      setActionError(apiError(err, "Action failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveIssue = async (issueId) => {
    setActionError("");
    try {
      await issueApi.updateStatus(issueId, "resolved");
      reloadIssues();
    } catch (err) {
      setActionError(apiError(err, "Could not resolve issue"));
    }
  };

  const activeCoordinators = (coordinators || []).filter((c) => c.isActive !== false);

  return (
    <div>
      <Link to="/manage/bookings" className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> All bookings
      </Link>

      {loading && (
        <div className="detail-grid">
          <div className="card skeleton skeleton-tall" />
          <div className="card skeleton" />
        </div>
      )}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && booking && (
        <>
          <div className="page-head">
            <p className="eyebrow">Booking</p>
            <div className="title-row">
              <h1>
                {booking.eventType} · {booking.hall?.name}
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

          {actionError && <p role="alert">{actionError}</p>}

          <div className="detail-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-head">
                  <h2>Event details</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    <div>
                      <dt>Customer</dt>
                      <dd>{booking.customer?.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${booking.customer?.email}`}>{booking.customer?.email}</a>
                      </dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>
                        {booking.customer?.phone ? (
                          <a href={`tel:+91${booking.customer.phone}`}>{formatPhone(booking.customer.phone)}</a>
                        ) : (
                          <span className="muted">Not added yet</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Hall</dt>
                      <dd>{booking.hall?.name}</dd>
                    </div>
                    <div>
                      <dt>Hall capacity</dt>
                      <dd>{booking.hall?.capacity}</dd>
                    </div>
                    <div>
                      <dt>Guest count</dt>
                      <dd>{booking.guestCount}</dd>
                    </div>
                    <div>
                      <dt>Package</dt>
                      <dd>{booking.package?.name || "None"}</dd>
                    </div>
                    {booking.decidedBy && (
                      <div>
                        <dt>Decision by</dt>
                        <dd>
                          {booking.decidedBy.name}
                          <br />
                          <span className="muted small">{new Date(booking.decidedAt).toLocaleString()}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                  {booking.hall && booking.guestCount > booking.hall.capacity && (
                    <p role="alert">
                      <Icon name="alert" size={16} /> Guest count exceeds hall capacity ({booking.hall.capacity}).
                    </p>
                  )}
                  <h3>Requirements</h3>
                  <p className={booking.requirements ? "" : "muted"}>{booking.requirements || "None"}</p>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Selections & estimate</h2>
                </div>
                <div className="panel-body">
                  <h3>Food</h3>
                  <NamedList items={booking.food} />
                  <h3>Decorations</h3>
                  <NamedList items={booking.decorations} />
                  <h3>Additional services</h3>
                  <NamedList items={booking.services} />
                  <dl className="cost-lines">
                    <div className="cost-total">
                      <dt>Estimated cost</dt>
                      <dd>{formatRs(booking.estimatedCost)}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Payment</h2>
                </div>
                <div className="panel-body">
                  {!paymentSummary && <p className="muted">Loading payment details…</p>}
                  {paymentSummary && (
                    <dl className="kv-list">
                      <div>
                        <dt>Total cost</dt>
                        <dd>{formatRs(paymentSummary.totalCost)}</dd>
                      </div>
                      <div>
                        <dt>Advance percentage</dt>
                        <dd>{paymentSummary.advancePercentage}%</dd>
                      </div>
                      {paymentSummary.payment ? (
                        <>
                          <div>
                            <dt>Advance paid</dt>
                            <dd>{formatRs(paymentSummary.payment.amount)}</dd>
                          </div>
                          <div>
                            <dt>Method</dt>
                            <dd>{PAYMENT_METHOD_LABELS[paymentSummary.payment.method] || paymentSummary.payment.method}</dd>
                          </div>
                          <div>
                            <dt>Transaction ID</dt>
                            <dd className="mono small">{paymentSummary.payment.transactionId}</dd>
                          </div>
                          <div>
                            <dt>Paid on</dt>
                            <dd>{new Date(paymentSummary.payment.paidAt || paymentSummary.payment.createdAt).toLocaleString()}</dd>
                          </div>
                          <div>
                            <dt>Remaining balance</dt>
                            <dd>{formatRs(paymentSummary.remainingBalance)}</dd>
                          </div>
                        </>
                      ) : (
                        <div>
                          <dt>Status</dt>
                          <dd>
                            {booking.status === "approved" ? (
                              <span className="badge badge-warning">
                                Awaiting advance ({formatRs(paymentSummary.advanceAmount)})
                              </span>
                            ) : (
                              <span className="badge badge-neutral">Not applicable</span>
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Customer review</h2>
                </div>
                <div className="panel-body">
                  {review ? (
                    <>
                      <p className="stars large" aria-label={`${review.rating} out of 5`}>
                        {"★".repeat(review.rating)}
                        <span className="stars-empty">{"★".repeat(5 - review.rating)}</span>
                      </p>
                      {review.comment && <p>“{review.comment}”</p>}
                    </>
                  ) : (
                    <p className="muted">No review submitted yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="stack detail-aside">
              {["pending", "confirmed", "upcoming"].includes(booking.status) && (
                <section className="panel">
                  <div className="panel-head">
                    <h2>Actions</h2>
                  </div>
                  <div className="panel-body">
                    {booking.status === "pending" && (
                      <>
                        <p className="muted small">Approving lets the customer pay the advance to confirm the date.</p>
                        <div className="button-row">
                          <button
                            type="button"
                            className="button-primary"
                            disabled={submitting}
                            onClick={() => handleDecision("approved")}
                          >
                            <Icon name="check" size={16} /> Approve
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            disabled={submitting}
                            onClick={() => handleDecision("rejected")}
                          >
                            <Icon name="x" size={16} /> Reject
                          </button>
                        </div>
                      </>
                    )}
                    {booking.status === "confirmed" && (
                      <button
                        type="button"
                        className="button-primary"
                        disabled={submitting}
                        onClick={() => handleDecision("upcoming")}
                      >
                        Mark as upcoming
                      </button>
                    )}
                    {booking.status === "upcoming" && (
                      <>
                        {booking.preparationStatus !== "completed" && (
                          <p className="muted small">
                            <Icon name="alert" size={14} /> The coordinator hasn't marked preparation as complete yet.
                          </p>
                        )}
                        {!eventDateReached(booking.eventDate) && (
                          <p className="muted small">This can be marked completed on or after the event date.</p>
                        )}
                        <button
                          type="button"
                          className="button-primary"
                          disabled={submitting || !eventDateReached(booking.eventDate)}
                          onClick={() => handleDecision("completed")}
                        >
                          Mark as completed
                        </button>
                      </>
                    )}
                  </div>
                </section>
              )}

              <section className="panel">
                <div className="panel-head">
                  <h2>Coordinator</h2>
                  <span className="muted small">
                    Preparation: {PREPARATION_STATUS_LABELS[booking.preparationStatus] || booking.preparationStatus}
                  </span>
                </div>
                <div className="panel-body">
                  <p>
                    <span className="muted">Currently assigned:</span>{" "}
                    <strong>{booking.coordinator?.name || "None"}</strong>
                  </p>
                  {!COORDINATOR_ASSIGNABLE.includes(booking.status) && (
                    <p className="muted small">
                      {booking.status === "pending"
                        ? "Approve the booking before assigning a coordinator."
                        : booking.status === "approved"
                        ? "A coordinator can be assigned once the customer pays the advance and the booking is confirmed."
                        : "Coordinators can't be assigned to rejected or completed bookings."}
                    </p>
                  )}
                  {COORDINATOR_ASSIGNABLE.includes(booking.status) && (
                    <form onSubmit={handleAssignCoordinator} className="mt-8">
                      <div>
                        <label htmlFor="coordinator">Select coordinator</label>
                        <select
                          id="coordinator"
                          value={selectedCoordinatorId}
                          onChange={(e) => setSelectedCoordinatorId(e.target.value)}
                          required
                        >
                          <option value="">Choose a coordinator</option>
                          {activeCoordinators.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name} ({c.email})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" disabled={submitting || !selectedCoordinatorId}>
                        {booking.coordinator ? "Reassign" : "Assign"}
                      </button>
                      {coordinators && activeCoordinators.length === 0 && (
                        <p className="muted small mt-8">
                          No active coordinators yet — <Link to="/manage/coordinators">create one</Link>.
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Preparation tasks</h2>
                  {tasks?.length > 0 && (
                    <span className="muted small">
                      {tasks.filter((t) => t.status === "completed").length}/{tasks.length} done
                    </span>
                  )}
                </div>
                <div className="panel-body">
                  {tasksLoading && <p className="muted">Loading tasks…</p>}
                  {tasksError && <p role="alert">{tasksError}</p>}
                  {!tasksLoading && !tasksError && (!tasks || tasks.length === 0) && <p className="muted">No tasks yet.</p>}
                  {!tasksLoading && !tasksError && tasks?.length > 0 && (
                    <ul className="person-list stacked">
                      {tasks.map((task) => (
                        <li key={task._id}>
                          <span className="title-row">
                            <strong>{task.title}</strong>
                            <span className={`badge badge-${TASK_STATUS_TONE[task.status] || "neutral"}`}>
                              {TASK_STATUS_LABELS[task.status] || task.status}
                            </span>
                          </span>
                          {task.description && <span className="small">{task.description}</span>}
                          {task.reason && <span className="small">Why: {task.reason}</span>}
                          <span className="muted small">
                            {TASK_CATEGORY_LABELS[task.category] || task.category} ·{" "}
                            {task.source === "system"
                              ? `generated from booking · ${task.coordinator?.name || "Unassigned"}`
                              : `added manually by ${task.coordinator?.name || "Unknown"} (optional)`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Issues</h2>
                </div>
                <div className="panel-body">
                  {issuesLoading && <p className="muted">Loading issues…</p>}
                  {issuesError && <p role="alert">{issuesError}</p>}
                  {!issuesLoading && !issuesError && (!issues || issues.length === 0) && (
                    <p className="muted">No issues reported.</p>
                  )}
                  {!issuesLoading && !issuesError && issues?.length > 0 && (
                    <ul className="person-list stacked">
                      {issues.map((issue) => (
                        <li key={issue._id}>
                          <span className="title-row">
                            <strong>{issue.title}</strong>
                            <span className={`badge badge-${issue.status === "open" ? "warning" : "success"}`}>
                              {ISSUE_STATUS_LABELS[issue.status] || issue.status}
                            </span>
                          </span>
                          {issue.description && <span className="small">{issue.description}</span>}
                          <span className="muted small">Reported by {issue.coordinator?.name || "Unknown"}</span>
                          {issue.status === "open" && (
                            <button type="button" className="button-sm mt-8" onClick={() => handleResolveIssue(issue._id)}>
                              <Icon name="check" size={14} /> Mark resolved
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ManagerBookingDetails;
