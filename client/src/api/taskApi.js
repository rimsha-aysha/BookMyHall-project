import api from "./axiosInstance.js";

export const taskApi = {
  listForBooking: (bookingId) => api.get(`/tasks/booking/${bookingId}`),
  updateStatus: (taskId, status) => api.patch(`/tasks/${taskId}/status`, { status }),
};
