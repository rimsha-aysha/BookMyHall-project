import api from "./axiosInstance.js";

export const settingsApi = {
  getPublic: () => api.get("/settings/public"),
  get: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
};
