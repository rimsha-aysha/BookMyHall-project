import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import DateTile from "../../components/DateTile.jsx";
import StatCard, { StatGrid } from "../../components/StatCard.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";
import { formatTimeRange } from "../../utils/format.js";

const JOURNEY = [
  { icon: "building", title: "Browse halls", text: "Compare capacity, price, amenities and photos.", to: "/halls" },
  { icon: "camera", title: "See past events", text: "Get inspired by events we've hosted.", to: "/gallery" },
  { icon: "sparkles", title: "Plan with smart suggestions", text: "Get a plan matched to your guests and budget.", to: "/booking" },
  { icon: "list", title: "Track your bookings", text: "Approval, payment, preparation and reviews.", to: "/my-bookings" },
];

const CustomerDashboard = () => {
  const { user, logout } = useAuth();
  const { data: bookings, loading, error, reload } = useFetch(bookingApi.listMine);

  const list = bookings || [];
  const awaitingPayment = list.filter((b) => b.status === "approved");
  const toReview = list.filter((b) => b.status === "completed");
  const active = list.filter((b) => ["pending", "approved", "confirmed", "upcoming"].includes(b.status));

  return (
    <div>
      <PageHeader
        eyebrow="Your account"
        title={`Welcome, ${user.name.split(" ")[0]}`}
        lead={`Signed in as ${user.email || user.name}.`}
        actions={
          <>
            <Link to="/booking" className="button-link button-primary">
              <Icon name="plus" size={16} /> Plan an event
            </Link>
            <button type="button" onClick={logout}>
              Log out
            </button>
          </>
        }
      />

      {awaitingPayment.length > 0 && (
        <div className="notice notice-accent">
          <strong>
            {awaitingPayment.length} booking{awaitingPayment.length > 1 ? "s are" : " is"} approved and awaiting your
            advance payment.
          </strong>
          <Link to={`/my-bookings/${awaitingPayment[0]._id}/pay`} className="button-link button-primary button-sm">
            Pay now
          </Link>
        </div>
      )}
      {toReview.length > 0 && (
        <div className="notice">
          Your event{toReview.length > 1 ? "s are" : " is"} complete — tell us how it went.
          <Link to={`/my-bookings/${toReview[0]._id}`}>Leave a review →</Link>
        </div>
      )}

      <StatGrid loading={loading} count={3}>
        <StatCard label="Active bookings" value={active.length} icon="calendar" to="/my-bookings" />
        <StatCard label="Awaiting payment" value={awaitingPayment.length} icon="card" to="/my-bookings" />
        <StatCard label="All bookings" value={list.length} icon="list" to="/my-bookings" />
      </StatGrid>

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Active bookings</h2>
            <Link to="/my-bookings" className="see-all">
              View all <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className="panel-body">
            {loading && <LoadingState variant="list" count={2} />}
            {error && <ErrorState message={error} onRetry={reload} />}
            {!loading && !error && active.length === 0 && (
              <EmptyState icon="calendar" title="No active bookings" message="Plan your next event in a few minutes.">
                <Link to="/booking" className="button-link button-primary">
                  Plan an event
                </Link>
              </EmptyState>
            )}
            <div className="booking-rows">
              {active.slice(0, 5).map((b) => (
                <Link key={b._id} to={`/my-bookings/${b._id}`} className="booking-row">
                  <DateTile date={b.eventDate} />
                  <div className="booking-row-main">
                    <div className="booking-row-title">{b.eventType}</div>
                    <div className="booking-row-meta">
                      <span>
                        <Icon name="building" size={14} /> {b.hall?.name}
                      </span>
                      <span>
                        <Icon name="clock" size={14} /> {formatTimeRange(b.startTime, b.endTime)}
                      </span>
                    </div>
                  </div>
                  <div className="booking-row-side">
                    <StatusBadge status={b.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Quick links</h2>
          </div>
          <div className="action-grid">
            {JOURNEY.map((step) => (
              <Link key={step.to} to={step.to} className="action-card">
                <span className="action-icon">
                  <Icon name={step.icon} size={20} />
                </span>
                <span className="action-text">
                  <strong>{step.title}</strong>
                  <span className="muted small">{step.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CustomerDashboard;
