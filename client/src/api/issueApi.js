import api from "./axiosInstance.js";

export const issueApi = {
  listAll: (params) => api.get("/issues", { params }),
  listForBooking: (bookingId) => api.get(`/issues/booking/${bookingId}`),
  create: (bookingId, data) => api.post(`/issues/booking/${bookingId}`, data),
  updateStatus: (issueId, status) => api.patch(`/issues/${issueId}/status`, { status }),
};
