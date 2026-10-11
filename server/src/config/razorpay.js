import crypto from "crypto";
import Razorpay from "razorpay";

// TEST MODE keys only (rzp_test_…), read from server/.env:
//   RAZORPAY_KEY_ID      public — sent to the browser to open Checkout
//   RAZORPAY_KEY_SECRET  private — never leaves the server
// Read lazily: ES imports are evaluated before server.js calls dotenv.config().

// This project is restricted to Razorpay TEST MODE: a live key is refused
// and online payment stays disabled.
let warnedAboutLiveKey = false;
export const isRazorpayConfigured = () => {
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: secret } = process.env;
  if (!keyId || !secret) return false;
  if (!keyId.startsWith("rzp_test_")) {
    if (!warnedAboutLiveKey) {
      console.error("RAZORPAY_KEY_ID is not a test-mode key (rzp_test_…) — online payments are disabled.");
      warnedAboutLiveKey = true;
    }
    return false;
  }
  return true;
};

export const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID;

let client = null;
export const getRazorpay = () => {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
};

// Razorpay signs "<order_id>|<payment_id>" with the key secret (HMAC-SHA256,
// hex). A valid signature proves Razorpay — not the browser — produced this
// payment for this order. Compared in constant time.
export const isValidPaymentSignature = (orderId, paymentId, signature) => {
  if (![orderId, paymentId, signature].every((v) => typeof v === "string" && v.length > 0)) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Razorpay amounts are in the smallest currency unit (paise for INR).
export const toPaise = (rupees) => Math.round(rupees * 100);
