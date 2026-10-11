import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useFetch } from "../../hooks/useFetch.js";
import { reportApi } from "../../api/reportApi.js";
import PageHeader from "../../components/PageHeader.jsx";
import StatCard, { StatGrid, ActionCard } from "../../components/StatCard.jsx";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import Icon from "../../components/Icon.jsx";
import { ErrorState } from "../../components/States.jsx";
import { STAFF_STATUS_LABELS } from "../../constants/bookingStatus.js";
import { formatRs, formatDate, formatTimeRange } from "../../utils/format.js";

const PREPARATION_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const QUICK_ACTIONS = [
  { to: "/manage/bookings", icon: "list", title: "Review bookings", text: "Approve, reject, track" },
  { to: "/manage/calendar", icon: "calendar", title: "Booking calendar", text: "All halls by date" },
  { to: "/manage/customers", icon: "users", title: "Customers", text: "Customer directory" },
  { to: "/manage/payments", icon: "card", title: "Payments", text: "All advance payments" },
  { to: "/manage/managers", icon: "user", title: "Managers", text: "Accounts & permissions" },
  { to: "/manage/coordinators", icon: "briefcase", title: "Coordinators", text: "Event coordinators" },
  { to: "/manage/halls", icon: "building", title: "Catalog", text: "Halls, packages, food & more" },
  { to: "/manage/gallery", icon: "camera", title: "Event gallery", text: "Publish past events" },
  { to: "/manage/settings", icon: "settings", title: "Settings", text: "Business details & policies" },
];

const OwnerDashboard = () => {
  const { user } = useAuth();
  const { data: overview, loading, error, reload } = useFetch(reportApi.getOverview);
  const byStatus = overview?.bookings.byStatus || {};
  const maxHallUsage = Math.max(1, ...(overview?.hallUsage || []).map((h) => h.bookingCount));

  return (
    <div>
      <PageHeader
        eyebrow="Owner"
        title="Dashboard"
        lead={`Welcome back, ${user.name.split(" ")[0]}. A full overview of bookings, revenue and operations.`}
        actions={
          <>
            <Link to="/manage/calendar" className="button-link">
              <Icon name="calendar" size={16} /> Calendar
            </Link>
            <Link to="/manage/bookings" className="button-link button-primary">
              Review bookings
            </Link>
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      <StatGrid loading={loading} count={5}>
        {overview && (
          <>
            <StatCard label="Total bookings" value={overview.bookings.total} icon="list" to="/manage/bookings" />
            <StatCard
              label="Pending requests"
              value={byStatus.pending || 0}
              icon="clock"
              tone={byStatus.pending ? "warning" : undefined}
              to="/manage/bookings"
            />
            <StatCard label="Confirmed events" value={byStatus.confirmed || 0} icon="check" />
            <StatCard label="Upcoming events" value={byStatus.upcoming || 0} icon="calendar" />
            <StatCard
              label="Revenue received"
              value={formatRs(overview.revenue.totalRevenue)}
              hint={`${overview.revenue.paymentCount} payment${overview.revenue.paymentCount === 1 ? "" : "s"}`}
              icon="card"
              to="/manage/payments"
            />
          </>
        )}
      </StatGrid>

      {overview && (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>Upcoming events</h2>
              <Link to="/manage/calendar" className="see-all">
                Open calendar <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            {overview.upcomingEvents.length === 0 ? (
              <div className="panel-body">
                <p className="muted">No upcoming events.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Hall</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Coordinator</th>
                    <th>Preparation</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.upcomingEvents.map((e) => (
                    <tr key={e.bookingId}>
                      <td data-label="Date">
                        <strong>{formatDate(e.eventDate)}</strong>
                        <br />
                        <span className="muted small">{formatTimeRange(e.startTime, e.endTime)}</span>
                      </td>
                      <td data-label="Event">
                        <Link to={`/manage/bookings/${e.bookingId}`}>{e.eventType}</Link>
                      </td>
                      <td data-label="Hall">{e.hallName || "—"}</td>
                      <td data-label="Customer">{e.customerName || "—"}</td>
                      <td data-label="Status">
                        <StatusBadge status={e.status} />
                      </td>
                      <td data-label="Coordinator">{e.coordinatorName || <span className="muted">Not assigned</span>}</td>
                      <td data-label="Preparation">{PREPARATION_LABELS[e.preparationStatus] || e.preparationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <div className="dash-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-head">
                  <h2>Quick actions</h2>
                </div>
                <div className="action-grid">
                  {QUICK_ACTIONS.map((a) => (
                    <ActionCard key={a.to} {...a} />
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Hall usage</h2>
                  <span className="muted small">
                    {overview.halls.active} active of {overview.halls.total} halls
                  </span>
                </div>
                <div className="panel-body">
                  {overview.hallUsage.length === 0 ? (
                    <p className="muted">No halls yet.</p>
                  ) : (
                    <dl className="kv-list">
                      {overview.hallUsage.map((h) => (
                        <div key={h.hallId}>
                          <dt className="grow">
                            {h.hallName}
                            <span className="meter mt-8" aria-hidden="true">
                              <span style={{ width: `${(h.bookingCount / maxHallUsage) * 100}%` }} />
                            </span>
                          </dt>
                          <dd>{h.bookingCount}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Customer reviews</h2>
                  {overview.reviews.count > 0 && (
                    <span className="muted small">
                      <span className="stars">★</span> {overview.reviews.average}/5 from {overview.reviews.count} review
                      {overview.reviews.count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="panel-body">
                  {overview.reviews.count === 0 ? (
                    <p className="muted">No reviews yet.</p>
                  ) : (
                    <>
                      <p className="muted small">
                        {[5, 4, 3, 2, 1].map((n) => `${n}★ ${overview.reviews.ratingBreakdown[n]}`).join(" · ")}
                      </p>
                      <ul className="person-list stacked">
                        {overview.reviews.recent.map((r) => (
                          <li key={r.reviewId}>
                            <span>
                              <span className="stars">{"★".repeat(r.rating)}</span> <strong>{r.customerName}</strong>{" "}
                              <span className="muted small">
                                — {r.eventType}
                                {r.hallName && ` at ${r.hallName}`}
                              </span>
                            </span>
                            {r.comment && <span className="small">“{r.comment}”</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            </div>

            <div className="stack">
              <section className="panel">
                <div className="panel-head">
                  <h2>Bookings by status</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    {Object.entries(byStatus).map(([status, count]) => (
                      <div key={status}>
                        <dt>{STAFF_STATUS_LABELS[status] || status}</dt>
                        <dd>{count}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Revenue</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    <div>
                      <dt>Total received</dt>
                      <dd>{formatRs(overview.revenue.totalRevenue)}</dd>
                    </div>
                    <div>
                      <dt>Successful payments</dt>
                      <dd>{overview.revenue.paymentCount}</dd>
                    </div>
                    <div>
                      <dt>Outstanding on paid bookings</dt>
                      <dd>{formatRs(overview.revenue.outstandingBalance)}</dd>
                    </div>
                    <div>
                      <dt>Value of confirmed, upcoming &amp; completed</dt>
                      <dd>{formatRs(overview.revenue.bookedValue)}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Customers & operations</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    <div>
                      <dt>Registered customers</dt>
                      <dd>{overview.customers.totalRegistered}</dd>
                    </div>
                    <div>
                      <dt>Customers with a booking</dt>
                      <dd>{overview.customers.withBookings}</dd>
                    </div>
                    <div>
                      <dt>Open coordinator issues</dt>
                      <dd>
                        {overview.issues.open} of {overview.issues.total}
                      </dd>
                    </div>
                    <div>
                      <dt>Published gallery events</dt>
                      <dd>{overview.gallery.publishedEntries}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Manager activity</h2>
                </div>
                <div className="panel-body">
                  <dl className="kv-list">
                    <div>
                      <dt>Awaiting review</dt>
                      <dd>{overview.managerActivity.pendingReview}</dd>
                    </div>
                    <div>
                      <dt>Approved</dt>
                      <dd>{overview.managerActivity.approved}</dd>
                    </div>
                    <div>
                      <dt>Rejected</dt>
                      <dd>{overview.managerActivity.rejected}</dd>
                    </div>
                  </dl>
                  {overview.managerActivity.byManager.length === 0 ? (
                    <p className="muted small mt-8">No managers yet.</p>
                  ) : (
                    <ul className="person-list mt-8">
                      {overview.managerActivity.byManager.map((m) => (
                        <li key={m.managerId}>
                          <span>
                            <strong>{m.name}</strong>
                            <br />
                            <span className="muted small">{m.email}</span>
                          </span>
                          <span className="muted small">
                            {m.approved} approved · {m.rejected} rejected
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Coordinator activity</h2>
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
                            {c.assignedBookings} events · {c.tasksCompleted}/{c.tasksTotal} tasks · {c.issuesReported}{" "}
                            issues ({c.issuesResolved} resolved)
                          </span>
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

export default OwnerDashboard;
