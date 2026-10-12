import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { bookingApi } from "../../api/bookingApi.js";
import { ROLES } from "../../constants/roles.js";
import MonthCalendar, { CalendarLegend } from "../../components/MonthCalendar.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { StatusBadge } from "../../components/BookingStatus.jsx";
import { STATUS_TONE, STATUS_GLYPH, STAFF_STATUS_LABELS } from "../../constants/bookingStatus.js";
import { apiError, formatDate, formatTime, formatTimeRange, todayInputValue } from "../../utils/format.js";
import { isoToDateKey, toMonthKey } from "../../utils/calendar.js";

// payment_pending is defined in the enum but never set by the app, so it
// isn't listed. Rejected requests are hidden unless a filter asks for them.
const LEGEND_STATUSES = ["pending", "approved", "confirmed", "upcoming", "completed", "rejected"];

const STATUS_FILTERS = [
  ["active", "All except rejected"],
  ["all", "All statuses"],
  ...LEGEND_STATUSES.map((s) => [s, STAFF_STATUS_LABELS[s]]),
];

const MAX_EVENTS = 3;

const matchesStatus = (filter, status) =>
  filter === "all" ? true : filter === "active" ? status !== "rejected" : status === filter;

// Staff month view of bookings. Manager/Owner see all halls (filterable);
// a Coordinator sees only bookings assigned to them — the server enforces
// both, this page only renders what it's given.
const BookingCalendar = () => {
  const { user } = useAuth();
  const isCoordinator = user.role === ROLES.COORDINATOR;
  const detailsPath = (id) => (isCoordinator ? `/coordinator/bookings/${id}` : `/manage/bookings/${id}`);

  const [month, setMonth] = useState(() => toMonthKey(todayInputValue()));
  const [hall, setHall] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedDate, setSelectedDate] = useState("");
  const [halls, setHalls] = useState([]);
  // Fetched months, keyed by hall filter/month/refresh: { bookings } or { error }.
  const [months, setMonths] = useState({});
  const [refresh, setRefresh] = useState(0);

  const key = `${hall}:${month}:${refresh}`;
  const entry = months[key];

  useEffect(() => {
    if (entry) return undefined;
    let active = true;
    bookingApi
      .getCalendar({ month, ...(hall && { hall }) })
      .then((res) => {
        if (!active) return;
        setHalls(res.data.data.halls);
        setMonths((prev) => ({ ...prev, [key]: { bookings: res.data.data.bookings } }));
      })
      .catch((err) => {
        if (active) {
          const error = apiError(err, "Could not load the booking calendar");
          setMonths((prev) => ({ ...prev, [key]: { error } }));
        }
      });
    return () => {
      active = false;
    };
  }, [hall, month, key, entry]);

  const current = entry || {};
  const loading = !entry;
  const visible = (current.bookings || []).filter((b) => matchesStatus(statusFilter, b.status));

  const byDate = visible.reduce((acc, b) => {
    const dateKey = isoToDateKey(b.eventDate);
    (acc[dateKey] = acc[dateKey] || []).push(b);
    return acc;
  }, {});

  const today = todayInputValue();
  const selectedBookings = byDate[selectedDate] || [];
  const hallName = halls.find((h) => h._id === hall)?.name;
  const legendStatuses = LEGEND_STATUSES.filter((s) => statusFilter === "all" || matchesStatus(statusFilter, s));

  const changeMonth = (next) => {
    setMonth(next);
    setSelectedDate("");
  };

  const toggleDay = (dateKey) => setSelectedDate((prev) => (prev === dateKey ? "" : dateKey));

  const cellClass = (dateKey) =>
    [
      "staff-cell",
      byDate[dateKey]?.length ? "has-bookings" : "",
      selectedDate === dateKey ? "selected" : "",
      dateKey === today ? "is-today" : "",
      dateKey < today ? "is-past" : "",
    ].join(" ");

  const renderDay = (dateKey) => {
    const items = byDate[dateKey] || [];
    const label = `${formatDate(dateKey, { weekday: "long", day: "numeric", month: "long" })}: ${
      items.length || "no"
    } booking${items.length === 1 ? "" : "s"}`;
    return (
      <>
        <button
          type="button"
          className="staff-day-btn"
          aria-pressed={selectedDate === dateKey}
          aria-label={label}
          data-date={dateKey}
          onClick={() => toggleDay(dateKey)}
        >
          <span className="calendar-day-num">{Number(dateKey.slice(8))}</span>
          {items.length > 0 && <span className="staff-day-count">{items.length}</span>}
        </button>
        {items.slice(0, MAX_EVENTS).map((b) => (
          <Link
            key={b._id}
            to={detailsPath(b._id)}
            className={`calendar-event tone-${STATUS_TONE[b.status] || "neutral"}`}
            title={`${b.eventType} · ${b.hall?.name || ""} · ${formatTimeRange(b.startTime, b.endTime)} · ${
              STAFF_STATUS_LABELS[b.status] || b.status
            }`}
          >
            <span className="calendar-event-time">
              <span className="status-glyph" aria-hidden="true">
                {STATUS_GLYPH[b.status]}
              </span>
              {formatTime(b.startTime)}
            </span>
            <span className="calendar-event-title">{b.eventType}</span>
            {!hall && <span className="calendar-event-hall">{b.hall?.name}</span>}
            <span className="sr-only">{STAFF_STATUS_LABELS[b.status] || b.status}</span>
          </Link>
        ))}
        {items.length > MAX_EVENTS && (
          <button type="button" className="calendar-more" onClick={() => setSelectedDate(dateKey)}>
            +{items.length - MAX_EVENTS} more
          </button>
        )}
      </>
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow={isCoordinator ? "My events" : "Operations"}
        title="Booking Calendar"
        lead={
          isCoordinator
            ? "Your assigned events by date. Select an event to open it."
            : "Every hall's bookings by date. Filter by hall or status, and select an event to open its details."
        }
        actions={
          <button type="button" onClick={() => setRefresh((n) => n + 1)} disabled={loading}>
            <Icon name="refresh" size={16} /> Refresh
          </button>
        }
      />

      <div className="toolbar">
        <label>
          Hall
          <select value={hall} onChange={(e) => setHall(e.target.value)}>
            <option value="">All halls</option>
            {halls.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}
                {h.isActive === false ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {current.bookings && (
          <span className="toolbar-result muted small" aria-live="polite">
            {visible.length} booking{visible.length === 1 ? "" : "s"} this month
          </span>
        )}
      </div>

      <div className="calendar-layout">
        <MonthCalendar
          month={month}
          onMonthChange={changeMonth}
          renderDay={renderDay}
          cellClass={cellClass}
          loading={loading}
          legend={
            <CalendarLegend
              items={legendStatuses.map((s) => ({
                label: STAFF_STATUS_LABELS[s],
                swatch: `legend-event tone-${STATUS_TONE[s]}`,
                content: STATUS_GLYPH[s],
              }))}
            />
          }
        >
          {current.error && (
            <div className="calendar-message is-booked calendar-state" role="alert">
              <Icon name="alert" size={16} />
              <span>
                {current.error}{" "}
                <button type="button" className="link-button" onClick={() => setRefresh((n) => n + 1)}>
                  Try again
                </button>
              </span>
            </div>
          )}
          {current.bookings && visible.length === 0 && (
            <p className="calendar-message is-info calendar-state">
              <Icon name="calendar" size={16} />
              No bookings {hallName ? `for ${hallName} ` : ""}this month
              {isCoordinator ? " assigned to you" : ""}.
            </p>
          )}
        </MonthCalendar>

        <aside className="calendar-details card card-body" aria-live="polite">
          {!selectedDate ? (
            <>
              <h2>Day details</h2>
              <p className="muted small">Select a day to see all of its bookings, or an event to open it.</p>
            </>
          ) : (
            <>
              <h2>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
              <p className="muted small">
                {selectedBookings.length} booking{selectedBookings.length === 1 ? "" : "s"}
                {hallName ? ` in ${hallName}` : ""}
              </p>
              <div className="calendar-booking-list">
                {selectedBookings.map((b) => (
                  <article key={b._id} className="calendar-booking">
                    <div className="calendar-booking-head">
                      <strong>{b.eventType}</strong>
                      <StatusBadge status={b.status} />
                    </div>
                    <dl className="facts">
                      <div>
                        <dt>
                          <Icon name="clock" size={14} /> Time
                        </dt>
                        <dd>{formatTimeRange(b.startTime, b.endTime)}</dd>
                      </div>
                      <div>
                        <dt>
                          <Icon name="building" size={14} /> Hall
                        </dt>
                        <dd>{b.hall?.name || "—"}</dd>
                      </div>
                      <div>
                        <dt>
                          <Icon name="user" size={14} /> Customer
                        </dt>
                        <dd>{b.customer?.name || b.walkInCustomer?.name || "—"}</dd>
                      </div>
                      <div>
                        <dt>
                          <Icon name="users" size={14} /> Guests
                        </dt>
                        <dd>{b.guestCount}</dd>
                      </div>
                      {!isCoordinator && (
                        <div>
                          <dt>
                            <Icon name="briefcase" size={14} /> Coordinator
                          </dt>
                          <dd>{b.coordinator?.name || "Not assigned"}</dd>
                        </div>
                      )}
                    </dl>
                    <Link to={detailsPath(b._id)} className="button-link button-sm">
                      Open booking <Icon name="arrowRight" size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default BookingCalendar;
