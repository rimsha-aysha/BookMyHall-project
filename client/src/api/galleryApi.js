import api from "./axiosInstance.js";

export const galleryApi = {
  listPublished: (params) => api.get("/gallery", { params }),
  getPublishedById: (id) => api.get(`/gallery/${id}`),
  listAll: () => api.get("/gallery/manage/all"),
  create: (data) => api.post("/gallery", data),
  update: (id, data) => api.put(`/gallery/${id}`, data),
  setPublished: (id, isPublished) => api.patch(`/gallery/${id}/publish`, { isPublished }),
  remove: (id) => api.delete(`/gallery/${id}`),
};
