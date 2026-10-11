import api from "./axiosInstance.js";

export const reviewApi = {
  getForBooking: (bookingId) => api.get(`/reviews/booking/${bookingId}`),
  create: (bookingId, data) => api.post(`/reviews/booking/${bookingId}`, data),
  getForHall: (hallId) => api.get(`/reviews/hall/${hallId}`),
};
