import { monthGrid, monthLabel, shiftMonth, WEEKDAYS } from "../utils/calendar.js";
import Icon from "./Icon.jsx";

// Presentational month grid shared by the customer availability calendar and
// the staff booking calendar. The caller owns the data and renders each day
// cell via renderDay(dateKey); this only handles layout and month paging.
// `cellClass(dateKey)` optionally adds classes to a day's grid cell.
const MonthCalendar = ({ month, onMonthChange, minMonth, renderDay, cellClass, loading, legend, children }) => {
  const canGoBack = !minMonth || month > minMonth;

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <h3 className="calendar-title" aria-live="polite">
          {monthLabel(month)}
        </h3>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          aria-label="Next month"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      {legend}

      <div className={`calendar-grid ${loading ? "is-loading" : ""}`} aria-busy={loading || undefined}>
        {WEEKDAYS.map((day) => (
          <div key={day} className="calendar-weekday" aria-hidden="true">
            {day}
          </div>
        ))}
        {monthGrid(month).map((dateKey, i) =>
          dateKey ? (
            <div key={dateKey} className={`calendar-cell ${cellClass?.(dateKey) || ""}`}>
              {renderDay(dateKey)}
            </div>
          ) : (
            <div key={`blank-${i}`} className="calendar-cell calendar-blank" aria-hidden="true" />
          )
        )}
        {loading && (
          <div className="calendar-loading" role="status">
            <span className="spinner" aria-hidden="true" /> Loading availability…
          </div>
        )}
      </div>

      {children}
    </div>
  );
};

// items: [{ label, swatch: <className for the swatch span>, content? }]
export const CalendarLegend = ({ items }) => (
  <div className="calendar-legend" aria-label="Legend">
    {items.map(({ swatch, label, content }) => (
      <span key={label} className="calendar-legend-item">
        <span className={swatch} aria-hidden="true">
          {content}
        </span>
        {label}
      </span>
    ))}
  </div>
);

export default MonthCalendar;
