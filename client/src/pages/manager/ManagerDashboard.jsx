import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useFetch } from "../../hooks/useFetch.js";
import { reportApi } from "../../api/reportApi.js";
import { issueApi } from "../../api/issueApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import PageHeader from "../../components/PageHeader.jsx";
import StatCard, { StatGrid, ActionCard } from "../../components/StatCard.jsx";
import { StatusBadge, WalkInBadge, PaymentStatusBadge } from "../../components/BookingStatus.jsx";
import { bookingCustomer } from "../../utils/booking.js";
import DateTile from "../../components/DateTile.jsx";
import Icon from "../../components/Icon.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";
import { formatDate, formatTimeRange } from "../../utils/format.js";

const fetchOpenIssues = () => issueApi.listAll({ status: "open" });

const PREPARATION_STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const TASK_STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const noData = () => Promise.resolve({ data: { data: null } });

const QUICK_ACTIONS = [
  { to: "/manage/bookings/walk-in", icon: "plus", title: "Walk-in booking", text: "Book for a customer at the venue", perm: "bookingManagement" },
  { to: "/manage/bookings", icon: "list", title: "Review bookings", text: "Approve, reject and record payments", perm: "bookingManagement" },
  { to: "/manage/calendar", icon: "calendar", title: "Booking calendar", text: "All halls by date", perm: "bookingManagement" },
  { to: "/manage/coordinators", icon: "users", title: "Coordinators", text: "Create and manage accounts", perm: "coordinatorManagement" },
  { to: "/manage/halls", icon: "building", title: "Halls", text: "Photos, capacity and pricing", perm: "catalogManagement" },
  { to: "/manage/packages", icon: "gift", title: "Packages", text: "Bundles and inclusions", perm: "catalogManagement" },
  { to: "/manage/food", icon: "utensils", title: "Food", text: "Menu items", perm: "catalogManagement" },
  { to: "/manage/decorations", icon: "sparkles", title: "Decorations", text: "Décor options", perm: "catalogManagement" },
  { to: "/manage/services", icon: "briefcase", title: "Services", text: "Additional services", perm: "catalogManagement" },
  { to: "/manage/gallery", icon: "camera", title: "Event gallery", text: "Publish past events", perm: "galleryManagement" },
];

const SummaryList = ({ data, labels }) => (
  <dl className="kv-list">
    {Object.entries(data).map(([status, count]) => (
      <div key={status}>
        <dt>{labels[status] || status}</dt>
        <dd>{count}</dd>
      </div>
    ))}
  </dl>
);

const ManagerDashboard = () => {
  const { user } = useAuth();
  const { data: overview, loading, error, reload } = useFetch(reportApi.getManagerOverview);
  // Owner-controlled per-manager permissions — hide what this manager can't use.
  const can = (key) => user.permissions?.[key] !== false;
  const { data: openIssues, error: issuesError } = useFetch(can("issueManagement") ? fetchOpenIssues : noData);
  const { data: bookings, loading: bookingsLoading } = useFetch(can("bookingManagement") ? bookingApi.listAll : noData);

  const confirmedCount = bookings ? bookings.filter((b) => b.status === "confirmed").length : null;
  const actions = QUICK_ACTIONS.filter((a) => can(a.perm));

  return (
    <div>
      <PageHeader
        eyebrow="Manager"
        title="Dashboard"
        lead={`Welcome back, ${user.name.split(" ")[0]}. Here's what needs your attention.`}
        actions={
          can("bookingManagement") && (
            <>
              <Link to="/manage/calendar" className="button-link">
                <Icon name="calendar" size={16} /> Calendar
              </Link>
              <Link to="/manage/bookings" className="button-link">
                Review bookings
              </Link>
              <Link to="/manage/bookings/walk-in" className="button-link button-primary">
                <Icon name="plus" size={16} /> Walk-in Booking
              </Link>
            </>
          )
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      <StatGrid loading={loading} count={5}>
        {overview && (
          <>
            <StatCard label="Total bookings" value={overview.totalBookings} icon="list" />
            <StatCard
              label="Pending requests"
              value={overview.pendingBookings}
              icon="clock"
              tone={overview.pendingBookings ? "warning" : undefined}
              to={can("bookingManagement") ? "/manage/bookings" : undefined}
            />
            <StatCard label="Awaiting payment" value={overview.paymentSummary.awaitingPayment} icon="card" />
            {confirmedCount !== null && <StatCard label="Confirmed events" value={confirmedCount} icon="check" />}
            <StatCard label="Upcoming events" value={overview.upcomingEvents} icon="calendar" />
          </>
        )}
      </StatGrid>

      <div className="dash-grid">
        <div className="stack">
          {can("bookingManagement") && (
            <section className="panel">
              <div className="panel-head">
                <h2>Recent bookings</h2>
                <Link to="/manage/bookings" className="see-all">
                  View all <Icon name="arrowRight" size={16} />
                </Link>
              </div>
              <div className="panel-body">
                {bookingsLoading && <LoadingState variant="list" count={3} />}
                {bookings && bookings.length === 0 && (
                  <EmptyState title="No bookings yet" message="New booking requests will appear here." />
                )}
                <div className="booking-rows">
                  {(bookings || []).slice(0, 5).map((b) => (
                    <Link key={b._id} to={`/manage/bookings/${b._id}`} className="booking-row">
                      <DateTile date={b.eventDate} />
                      <div className="booking-row-main">
                        <div className="booking-row-title">
                          {b.eventType} · {b.hall?.name} <WalkInBadge source={b.source} />
                        </div>
                        <div className="booking-row-meta">
                          <span>
                            <Icon name="user" size={14} /> {bookingCustomer(b).name}
                          </span>
                          <span>
                            <Icon name="clock" size={14} /> {formatTimeRange(b.startTime, b.endTime)}
                          </span>
                          <span>
                            <Icon name="users" size={14} /> {b.guestCount}
                          </span>
                        </div>
                      </div>
                      <div className="booking-row-side">
                        <StatusBadge status={b.status} />
                        <PaymentStatusBadge status={b.paymentStatus} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {overview && (
            <section className="panel">
              <div className="panel-head">
                <h2>Coordinator progress</h2>
              </div>
              <div className="panel-body">
                {overview.coordinatorActivity.length === 0 ? (
                  <p className="muted">No coordinators yet.</p>
                ) : (
                  <ul className="person-list">
                    {overview.coordinatorActivity.map((c) => (
                      <li key={c.coordinatorId}>
                        <span>
                          <strong>{c.name}</strong>
                          <br />
                          <span className="muted small">{c.email}</span>
                        </span>
                        <span className="muted small">
                          {c.assignedBookings} event{c.assignedBookings === 1 ? "" : "s"} · {c.tasksCompleted}/
                          {c.tasksTotal} tasks · {c.issuesReported} issue{c.issuesReported === 1 ? "" : "s"} (
                          {c.issuesResolved} resolved)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="stack">
          {actions.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h2>Quick actions</h2>
              </div>
              <div className="action-grid">
                {actions.map((a) => (
                  <ActionCard key={a.to} {...a} />
                ))}
              </div>
            </section>
          )}

          {can("issueManagement") && (
            <section className="panel">
              <div className="panel-head">
                <h2>Open coordinator issues</h2>
                {openIssues?.length > 0 && <span className="badge badge-warning">{openIssues.length} open</span>}
              </div>
              <div className="panel-body">
                {issuesError && <p role="alert">{issuesError}</p>}
                {openIssues && openIssues.length === 0 && <p className="muted">No open issues.</p>}
                {openIssues?.length > 0 && (
                  <ul className="person-list stacked">
                    {openIssues.map((issue) => (
                      <li key={issue._id}>
                        <Link to={`/manage/bookings/${issue.booking?._id}`}>
                          <strong>{issue.title}</strong>
                        </Link>
                        <span className="muted small">
                          {issue.booking?.eventType} at {issue.booking?.hall?.name} ·{" "}
                          {issue.booking?.eventDate && formatDate(issue.booking.eventDate)} · reported by{" "}
                          {issue.coordinator?.name || "Unknown"}
                        </span>
                        {issue.description && <span className="small">{issue.description}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {overview && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h2>Payments</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    <div>
                      <dt>Awaiting payment</dt>
                      <dd>{overview.paymentSummary.awaitingPayment}</dd>
                    </div>
                    <div>
                      <dt>Partially paid</dt>
                      <dd>{overview.paymentSummary.partiallyPaid ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Fully paid</dt>
                      <dd>{overview.paymentSummary.fullyPaid ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Offline payments awaiting confirmation</dt>
                      <dd>
                        {overview.paymentSummary.offlineAwaitingConfirmation > 0 ? (
                          <span className="badge badge-warning">{overview.paymentSummary.offlineAwaitingConfirmation}</span>
                        ) : (
                          overview.paymentSummary.offlineAwaitingConfirmation ?? "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Walk-in bookings</dt>
                      <dd>{overview.paymentSummary.walkInBookings ?? "—"}</dd>
                    </div>
                  </dl>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Event preparation</h2>
                </div>
                <div className="panel-body">
                  <SummaryList data={overview.preparationSummary} labels={PREPARATION_STATUS_LABELS} />
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>Preparation tasks</h2>
                  <span className="muted small">
                    Issues: {overview.openIssuesCount} open · {overview.resolvedIssuesCount} resolved
                  </span>
                </div>
                <div className="panel-body">
                  <SummaryList data={overview.taskSummary} labels={TASK_STATUS_LABELS} />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
