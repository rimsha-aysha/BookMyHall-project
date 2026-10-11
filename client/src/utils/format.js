import api from "../api/axiosInstance.js";

// Uploaded images are stored as root-relative "/uploads/<file>" paths on the
// API server; external images are absolute URLs and are used as-is.
const API_ORIGIN = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");

export const resolveImageUrl = (src) => {
  if (!src) return "";
  return src.startsWith("/uploads/") ? `${API_ORIGIN}${src}` : src;
};

export const formatRs = (amount) => `Rs. ${Math.round(Number(amount) || 0).toLocaleString("en-US")}`;

export const formatDate = (value, options = { day: "numeric", month: "short", year: "numeric" }) =>
  value ? new Date(value).toLocaleDateString(undefined, { timeZone: "UTC", ...options }) : "";

// "14:30" -> "2:30 PM". Display only; inputs and the API keep 24-hour HH:mm.
export const formatTime = (time) => {
  if (!/^\d{2}:\d{2}$/.test(time || "")) return time || "";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export const formatTimeRange = (start, end) => `${formatTime(start)} – ${formatTime(end)}`;

export const todayInputValue = () => new Date().toLocaleDateString("en-CA");

export const GENERIC_ERROR = "Something went wrong. Please try again.";

// User-facing message for a failed request. Validation and other 4xx
// messages from the API are written for users and shown as-is; network
// failures and server errors get a friendly generic message instead of raw
// text like "AxiosError" or a stack-derived 500 message. The original error
// is always logged for debugging.
export const apiError = (err, fallback = GENERIC_ERROR) => {
  const status = err?.response?.status;
  if (!status || status >= 500) {
    console.error(err);
    return status ? GENERIC_ERROR : "We couldn't reach the server. Check your connection and try again.";
  }
  const data = err.response.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join(", ");
  return data?.message || fallback;
};
