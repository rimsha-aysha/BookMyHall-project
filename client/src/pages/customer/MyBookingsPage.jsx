import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { bookingApi } from "../../api/bookingApi.js";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import DateTile from "../../components/DateTile.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";
import { formatRs, formatTimeRange, todayInputValue } from "../../utils/format.js";

const TABS = [
  ["upcoming", "Upcoming"],
  ["past", "Past"],
  ["all", "All"],
];

// "Past" = the event date has gone, or the booking is closed out.
const isPast = (b, today) =>
  b.status === "completed" || b.status === "rejected" || String(b.eventDate).slice(0, 10) < today;

const MyBookingsPage = () => {
  const { data, loading, error, reload } = useFetch(bookingApi.listMine);
  const navigate = useNavigate();
  const [tab, setTab] = useState("upcoming");
  const today = todayInputValue();

  const list = data || [];
  const counts = {
    upcoming: list.filter((b) => !isPast(b, today)).length,
    past: list.filter((b) => isPast(b, today)).length,
    all: list.length,
  };
  const shown = list.filter((b) => (tab === "all" ? true : tab === "past" ? isPast(b, today) : !isPast(b, today)));

  return (
    <div>
      <PageHeader
        title="My Bookings"
        lead="Track approval, payment, preparation and reviews for every event."
        actions={
          <Link to="/booking" className="button-link button-primary">
            <Icon name="plus" size={16} /> New booking
          </Link>
        }
      />

      {loading && <LoadingState variant="list" count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon="calendar"
          title="No bookings yet"
          message="Your bookings will appear here once you make a reservation."
        >
          <Link to="/halls" className="button-link">
            Browse halls
          </Link>
          <Link to="/booking" className="button-link button-primary">
            Plan an event
          </Link>
        </EmptyState>
      )}

      {!loading && !error && list.length > 0 && (
        <>
          <div className="chip-filter filter-bar" role="tablist" aria-label="Filter bookings">
            {TABS.map(([value, label]) => (
              <button
                type="button"
                key={value}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value)}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon="calendar"
              title={tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
              message={tab === "upcoming" ? "Ready to plan your next event?" : "Completed and past events will show here."}
            >
              {tab === "upcoming" && (
                <Link to="/booking" className="button-link button-primary">
                  Plan an event
                </Link>
              )}
            </EmptyState>
          ) : (
            <div className="booking-list">
              {shown.map((booking) => (
                <article key={booking._id} className="card booking-item">
                  <Link to={`/my-bookings/${booking._id}`} className="booking-item-main">
                    <DateTile date={booking.eventDate} />
                    <div className="booking-item-body">
                      <div className="booking-item-head">
                        <h3>{booking.eventType}</h3>
                        <StatusBadge status={booking.status} />
                      </div>
                      <div className="booking-item-meta">
                        <span>
                          <Icon name="building" size={14} /> {booking.hall?.name || "Hall"}
                        </span>
                        <span>
                          <Icon name="clock" size={14} /> {formatTimeRange(booking.startTime, booking.endTime)}
                        </span>
                        <span>
                          <Icon name="users" size={14} /> {booking.guestCount} guests
                        </span>
                        {booking.package?.name && (
                          <span>
                            <Icon name="gift" size={14} /> {booking.package.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="booking-item-side">
                    <span className="price-block">
                      <span className="muted small">Estimated</span>
                      <span className="price">{formatRs(booking.estimatedCost)}</span>
                    </span>
                    <div className="booking-item-actions">
                      {booking.status === "approved" && (
                        <button
                          type="button"
                          className="button-primary button-sm"
                          onClick={() => navigate(`/my-bookings/${booking._id}/pay`)}
                        >
                          <Icon name="card" size={15} /> Pay now
                        </button>
                      )}
                      {booking.status === "completed" && (
                        <button type="button" className="button-sm" onClick={() => navigate(`/my-bookings/${booking._id}`)}>
                          <Icon name="star" size={15} /> Review
                        </button>
                      )}
                      <button type="button" className="button-sm" onClick={() => navigate(`/my-bookings/${booking._id}`)}>
                        Details
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyBookingsPage;
