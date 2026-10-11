import api from "./axiosInstance.js";

export const paymentApi = {
  // Razorpay (test mode): the server prices the advance and opens the order.
  createOrder: (bookingId) => api.post(`/payments/${bookingId}/order`),
  // Checkout's success callback — the server verifies it before confirming.
  verify: (bookingId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) =>
    api.post(`/payments/${bookingId}/verify`, { razorpay_order_id, razorpay_payment_id, razorpay_signature }),
  reportFailure: (bookingId, razorpayOrderId, reason) =>
    api.post(`/payments/${bookingId}/failure`, { razorpay_order_id: razorpayOrderId, reason }),
  getForBooking: (bookingId) => api.get(`/payments/booking/${bookingId}`),
};
