// Indian mobile numbers: 10 digits starting with 6, 7, 8 or 9. Stored as the
// bare 10 digits; shown to Razorpay as +91XXXXXXXXXX.
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const INVALID_PHONE_MESSAGE = "Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9)";

// Drops spaces, dashes, brackets and a leading +91 / 91 / 0, so
// "+91 99776-65544" and "099776 65544" both become "9977665544". Anything
// that isn't a phone number (e.g. contains letters) is returned unchanged so
// validation rejects it rather than silently "fixing" it.
export const normalizePhone = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return trimmed;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
};

export const isValidIndianMobile = (value) => INDIAN_MOBILE_REGEX.test(normalizePhone(value) ?? "");

export const toE164India = (phone) => (phone ? `+91${phone}` : "");
