import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import CatalogGrid from "../../components/CatalogGrid.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import DateTile from "../../components/DateTile.jsx";
import Icon from "../../components/Icon.jsx";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import { formatRs, formatTimeRange } from "../../utils/format.js";

const STATUS_FILTERS = [
  ["all", "All"],
  ["pending", "Pending approval"],
  ["approved", "Awaiting payment"],
  ["confirmed", "Confirmed"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
  ["rejected", "Rejected"],
];

const matchesSearch = (b, q) =>
  !q ||
  [b.customer?.name, b.customer?.email, b.hall?.name, b.eventType]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes(q));

const ManagerBookings = () => {
  const { data, loading, error, reload } = useFetch(bookingApi.listAll);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const counts = (data || []).reduce((acc, b) => ({ ...acc, [b.status]: (acc[b.status] || 0) + 1 }), {});
  const items = (data || []).filter((b) => (status === "all" || b.status === status) && matchesSearch(b, q));

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Bookings"
        lead="Review requests, track payments and open any booking to manage it."
        actions={
          <Link to="/manage/calendar" className="button-link">
            <Icon name="calendar" size={16} /> Calendar view
          </Link>
        }
      />

      <div className="chip-filter filter-bar" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={status === value ? "active" : ""}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label} ({value === "all" ? data?.length || 0 : counts[value] || 0})
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label>
          Search
          <input
            type="search"
            placeholder="Customer, hall or event type"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {data && (
          <span className="toolbar-result muted small" aria-live="polite">
            Showing {items.length} of {data.length}
          </span>
        )}
      </div>

      <CatalogGrid
        layout="list"
        items={data ? items : data}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyIcon="list"
        emptyTitle={data?.length ? "No matching bookings" : "No bookings yet"}
        emptyMessage={data?.length ? "Try another status or search." : "New booking requests will appear here."}
        renderItem={(booking) => (
          <Link to={`/manage/bookings/${booking._id}`} className="booking-row">
            <DateTile date={booking.eventDate} />
            <div className="booking-row-main">
              <div className="booking-row-title">
                {booking.eventType} · {booking.hall?.name}
              </div>
              <div className="booking-row-meta">
                <span>
                  <Icon name="user" size={14} /> {booking.customer?.name}
                </span>
                <span>
                  <Icon name="clock" size={14} /> {formatTimeRange(booking.startTime, booking.endTime)}
                </span>
                <span>
                  <Icon name="users" size={14} /> {booking.guestCount} guests
                </span>
                <span>
                  <Icon name="briefcase" size={14} /> {booking.coordinator?.name || "No coordinator"}
                </span>
              </div>
            </div>
            <div className="booking-row-side">
              <StatusBadge status={booking.status} />
              <span className="price">{formatRs(booking.estimatedCost)}</span>
            </div>
          </Link>
        )}
      />
    </div>
  );
};

export default ManagerBookings;
