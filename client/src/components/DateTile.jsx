import { formatDate } from "../utils/format.js";

// Compact calendar-style date block for booking lists.
const DateTile = ({ date }) => (
  <div className="date-tile" aria-hidden="true">
    <span className="month">{formatDate(date, { month: "short" })}</span>
    <span className="day">{formatDate(date, { day: "numeric" })}</span>
    <span className="year">{formatDate(date, { year: "numeric" })}</span>
  </div>
);

export default DateTile;
