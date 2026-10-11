import api from "./axiosInstance.js";

export const suggestionApi = {
  get: (data) => api.post("/suggestions", data),
};
