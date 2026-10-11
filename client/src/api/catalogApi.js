import api from "./axiosInstance.js";

// Same REST shape for every catalog resource (Hall, Package, Food,
// Decoration, AdditionalService): active list/detail are public,
// manage/all + write operations require manager/owner auth (enforced server-side).
const buildResourceApi = (basePath) => ({
  listActive: () => api.get(basePath),
  getActiveById: (id) => api.get(`${basePath}/${id}`),
  listAll: () => api.get(`${basePath}/manage/all`),
  create: (data) => api.post(basePath, data),
  update: (id, data) => api.put(`${basePath}/${id}`, data),
  setStatus: (id, isActive) => api.patch(`${basePath}/${id}/status`, { isActive }),
  remove: (id) => api.delete(`${basePath}/${id}`),
});

export const hallsApi = buildResourceApi("/halls");
export const packagesApi = buildResourceApi("/packages");
export const foodsApi = buildResourceApi("/foods");
export const decorationsApi = buildResourceApi("/decorations");
export const servicesApi = buildResourceApi("/services");
