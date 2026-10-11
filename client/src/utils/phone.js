// Same rule as the server (server/src/utils/phone.js): a 10-digit Indian
// mobile number starting with 6, 7, 8 or 9, stored without formatting.
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const INVALID_PHONE_MESSAGE = "Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9).";

// For phone inputs: keeps digits only (letters and symbols can't be typed),
// at most 10 of them.
export const phoneInputValue = (raw) => raw.replace(/\D/g, "").slice(0, 10);

export const isValidIndianMobile = (value) => INDIAN_MOBILE_REGEX.test(value || "");

// "9977665544" -> "+91 99776 65544" for display.
export const formatPhone = (phone) => (phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : "");
