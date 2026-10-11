import { useEffect, useState } from "react";
import { bookingApi } from "../api/bookingApi.js";
import { apiError, formatDate, formatTimeRange, todayInputValue } from "../utils/format.js";
import { monthGrid, toMonthKey } from "../utils/calendar.js";
import MonthCalendar, { CalendarLegend } from "./MonthCalendar.jsx";
import Icon from "./Icon.jsx";

const TONES = {
  available: { label: "Available", note: "Available" },
  pending: { label: "Pending request", note: "Pending" },
  booked: { label: "Partly booked", note: "Limited" },
  full: { label: "Fully booked", note: "Booked" },
  past: { label: "Past date", note: "" },
};

const LEGEND = ["available", "pending", "booked", "full"].map((tone) => ({
  label: TONES[tone].label,
  swatch: `calendar-swatch tone-${tone}`,
}));

const SLOT_LABELS = { booked: "Booked", pending: "Pending" };
const SLOT_TONES = { booked: "danger", pending: "warning" };
const BOOKED_MESSAGE = "Sorry, this hall is already booked for this date.";

const dayTone = (dateKey, today, info) => {
  if (dateKey < today) return "past";
  if (!info) return "available";
  if (info.fullyBooked) return "full";
  return info.slots.some((s) => s.state === "booked") ? "booked" : "pending";
};

const longDate = (dateKey) =>
  formatDate(dateKey, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Customer-facing availability calendar for one hall, driven by
// GET /bookings/availability/:hallId?month=YYYY-MM. Each hall/month is
// fetched once and kept; bump refreshKey to force fresh data (e.g. after a
// 409 conflict on submit). Selecting a day only sets the date — the existing
// check-availability call and createBooking still validate the exact time.
// Fully booked days can't be picked; if the chosen date is fully booked in a
// newly selected hall, a warning is shown (and the server would refuse it).
const AvailabilityCalendar = ({ hallId, value, onChange, refreshKey = 0 }) => {
  const [month, setMonth] = useState(() => toMonthKey(value || todayInputValue()));
  // Fetched months, keyed by hall/month/refreshKey: { data } or { error }.
  const [months, setMonths] = useState({});
  // Fully booked date the customer last tapped (shows a short explanation).
  const [blockedDate, setBlockedDate] = useState("");

  const key = `${hallId}:${month}:${refreshKey}`;
  const entry = months[key];

  useEffect(() => {
    if (!hallId || entry) return undefined;
    let active = true;
    bookingApi
      .getHallAvailability(hallId, month)
      .then((res) => {
        if (active) setMonths((prev) => ({ ...prev, [key]: { data: res.data.data } }));
      })
      .catch((err) => {
        if (active) {
          const error = apiError(err, "Could not load availability for this hall");
          setMonths((prev) => ({ ...prev, [key]: { error } }));
        }
      });
    return () => {
      active = false;
    };
  }, [hallId, month, key, entry]);

  const retry = () =>
    setMonths((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const data = entry?.data;
  const error = entry?.error;
  const loading = !entry;
  const today = data?.today || todayInputValue();
  const days = new Map((data?.days || []).map((d) => [d.date, d]));
  const selectedInfo = value && toMonthKey(value) === month ? days.get(value) : null;

  if (!hallId) return null;

  const openDays = data
    ? monthGrid(month).filter((d) => d && d >= today && !days.get(d)?.fullyBooked).length
    : null;

  const renderDay = (dateKey) => {
    const tone = dayTone(dateKey, today, days.get(dateKey));
    const full = tone === "full";
    const selected = value === dateKey;
    return (
      <button
        type="button"
        className={`calendar-day tone-${data ? tone : "loading"} ${selected ? "selected" : ""} ${
          dateKey === today ? "is-today" : ""
        }`}
        // Fully booked days stay focusable/tappable (aria-disabled) so the
        // customer gets an explanation instead of a dead button.
        disabled={!data || tone === "past"}
        aria-disabled={full || undefined}
        aria-pressed={selected}
        data-date={dateKey}
        aria-label={`${longDate(dateKey)}${dateKey === today ? " (today)" : ""}${data ? ` — ${TONES[tone].label}` : ""}`}
        onClick={() => {
          if (full) {
            setBlockedDate(dateKey);
            return;
          }
          setBlockedDate("");
          onChange(dateKey);
        }}
      >
        <span className="calendar-day-num">{Number(dateKey.slice(8))}</span>
        {data && tone !== "past" && <span className="calendar-marker" aria-hidden="true" />}
        {data && TONES[tone].note && <span className="calendar-day-note">{TONES[tone].note}</span>}
      </button>
    );
  };

  const changeMonth = (next) => {
    setBlockedDate("");
    setMonth(next);
  };

  return (
    <MonthCalendar
      month={month}
      onMonthChange={changeMonth}
      minMonth={toMonthKey(today)}
      renderDay={renderDay}
      loading={loading}
      legend={<CalendarLegend items={LEGEND} />}
    >
      {error && (
        <div className="calendar-message is-booked calendar-state" role="alert">
          <Icon name="alert" size={16} />
          <span>
            {error}{" "}
            <button type="button" className="link-button" onClick={retry}>
              Try again
            </button>
          </span>
        </div>
      )}
      {blockedDate && (
        <p className="calendar-message is-booked" role="status">
          <Icon name="x" size={16} /> {BOOKED_MESSAGE} ({formatDate(blockedDate, { day: "numeric", month: "long" })})
        </p>
      )}
      {data && openDays === 0 && (
        <p className="calendar-message is-info">
          <Icon name="calendar" size={16} /> No availability for this period. Try the next month or another hall.
        </p>
      )}
      {selectedInfo?.fullyBooked && (
        <p role="alert">{longDate(value)} is fully booked for this hall — please pick another date.</p>
      )}

      <div className="calendar-selection" aria-live="polite">
        {!value && <p className="muted small">Select an available date to continue.</p>}
        {value && (
          <>
            <p className="selection-title">
              <strong>{longDate(value)}</strong>
              {data && toMonthKey(value) === month && !selectedInfo?.fullyBooked && (
                <span className="badge badge-success">Available</span>
              )}
            </p>
            {selectedInfo?.slots?.length > 0 ? (
              <>
                <p className="small muted">Some times are already taken — choose a time that doesn't overlap:</p>
                <div className="slot-list">
                  {selectedInfo.slots.map((s) => (
                    <span key={`${s.startTime}-${s.endTime}`} className={`badge badge-${SLOT_TONES[s.state]}`}>
                      {formatTimeRange(s.startTime, s.endTime)} · {SLOT_LABELS[s.state]}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              data && toMonthKey(value) === month && <p className="small muted">The whole day is free.</p>
            )}
          </>
        )}
      </div>
    </MonthCalendar>
  );
};

export default AvailabilityCalendar;
