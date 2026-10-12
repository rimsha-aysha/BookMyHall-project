import api from "./axiosInstance.js";

export const bookingApi = {
  create: (data) => api.post("/bookings", data),
  // Staff-entered booking for a customer at the venue (no account needed).
  createWalkIn: (data) => api.post("/bookings/walk-in", data),
  listMine: () => api.get("/bookings/my"),
  getById: (id) => api.get(`/bookings/${id}`),
  listAll: () => api.get("/bookings/manage/all"),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  assignCoordinator: (id, coordinatorId) =>
    api.patch(`/bookings/${id}/coordinator`, { coordinatorId }),
  listMyAssigned: () => api.get("/bookings/coordinator/my"),
  updatePreparationStatus: (id, preparationStatus) =>
    api.patch(`/bookings/${id}/preparation-status`, { preparationStatus }),
  checkAvailability: (params) => api.get("/bookings/check-availability", { params }),
  getHallAvailability: (hallId, month) => api.get(`/bookings/availability/${hallId}`, { params: { month } }),
  getCalendar: (params) => api.get("/bookings/calendar", { params }),
};
