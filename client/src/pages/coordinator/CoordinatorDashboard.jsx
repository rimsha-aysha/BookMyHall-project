import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import CatalogGrid from "../../components/CatalogGrid.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import StatCard, { StatGrid } from "../../components/StatCard.jsx";
import DateTile from "../../components/DateTile.jsx";
import Icon from "../../components/Icon.jsx";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import { formatTimeRange } from "../../utils/format.js";

const PREPARATION_STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const PREPARATION_TONE = { not_started: "neutral", in_progress: "warning", completed: "success" };

const CoordinatorDashboard = () => {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(bookingApi.listMyAssigned);
  const list = data || [];
  const count = (status) => list.filter((b) => b.preparationStatus === status).length;

  return (
    <div>
      <PageHeader
        eyebrow="Coordinator"
        title="My Events"
        lead={`Welcome back, ${user.name.split(" ")[0]}. Open an event to manage its tasks, issues and preparation.`}
        actions={
          <Link to="/coordinator/calendar" className="button-link">
            <Icon name="calendar" size={16} /> Calendar view
          </Link>
        }
      />

      <StatGrid loading={loading} count={4}>
        <StatCard label="Assigned events" value={list.length} icon="list" />
        <StatCard label="Not started" value={count("not_started")} icon="clock" />
        <StatCard label="In progress" value={count("in_progress")} icon="refresh" tone={count("in_progress") ? "warning" : undefined} />
        <StatCard label="Preparation complete" value={count("completed")} icon="check" />
      </StatGrid>

      <div className="section-head">
        <h2>Assigned events</h2>
      </div>
      <CatalogGrid
        layout="list"
        items={data}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyIcon="calendar"
        emptyTitle="No events assigned yet"
        emptyMessage="Events a manager assigns to you will appear here."
        renderItem={(booking) => (
          <Link to={`/coordinator/bookings/${booking._id}`} className="booking-row">
            <DateTile date={booking.eventDate} />
            <div className="booking-row-main">
              <div className="booking-row-title">
                {booking.eventType} · {booking.hall?.name}
              </div>
              <div className="booking-row-meta">
                <span>
                  <Icon name="user" size={14} /> {booking.customer?.name || booking.walkInCustomer?.name}
                </span>
                <span>
                  <Icon name="clock" size={14} /> {formatTimeRange(booking.startTime, booking.endTime)}
                </span>
                <span>
                  <Icon name="users" size={14} /> {booking.guestCount} guests
                </span>
              </div>
            </div>
            <div className="booking-row-side">
              <StatusBadge status={booking.status} />
              <span className={`badge badge-${PREPARATION_TONE[booking.preparationStatus] || "neutral"}`}>
                Prep: {PREPARATION_STATUS_LABELS[booking.preparationStatus] || booking.preparationStatus}
              </span>
            </div>
          </Link>
        )}
      />
    </div>
  );
};

export default CoordinatorDashboard;
