// Calendar date helpers. Everything works on plain "YYYY-MM-DD" / "YYYY-MM"
// strings — the same date-only form <input type="date"> produces and the
// server stores as UTC midnight — so a date never shifts by a day because of
// the viewer's time zone. Date objects are only built in UTC.

const pad = (n) => String(n).padStart(2, "0");

export const toMonthKey = (dateKey) => dateKey.slice(0, 7);

export const toDateKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

// eventDate from the API is an ISO string at UTC midnight.
export const isoToDateKey = (iso) => String(iso).slice(0, 10);

export const shiftMonth = (monthKey, delta) => {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export const monthLabel = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

// Day cells for a month grid: leading nulls for the weekday offset, then one
// "YYYY-MM-DD" key per day. Weeks start on Sunday.
export const monthGrid = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => toDateKey(year, month, i + 1)),
  ];
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
