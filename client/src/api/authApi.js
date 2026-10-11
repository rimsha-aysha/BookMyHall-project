import api from "./axiosInstance.js";

export const registerCustomer = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);
export const fetchCurrentUser = () => api.get("/auth/me");
// Customer's own profile — only the phone number is editable.
export const updateMyPhone = (phone) => api.patch("/auth/me", { phone });
export const listCoordinators = () => api.get("/auth/coordinators");

export const listManagers = () => api.get("/auth/managers");
export const createManager = (data) => api.post("/auth/managers", data);
export const setManagerStatus = (id, isActive) =>
  api.patch(`/auth/managers/${id}/status`, { isActive });
export const getManagerPermissions = (id) => api.get(`/auth/managers/${id}/permissions`);
export const updateManagerPermissions = (id, permissions) =>
  api.patch(`/auth/managers/${id}/permissions`, { permissions });

export const createCoordinator = (data) => api.post("/auth/coordinators", data);
export const setCoordinatorStatus = (id, isActive) =>
  api.patch(`/auth/coordinators/${id}/status`, { isActive });
