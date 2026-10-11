import api from "./axiosInstance.js";

export const reportApi = {
  getOverview: () => api.get("/reports/overview"),
  getManagerOverview: () => api.get("/reports/manager-overview"),
  getCustomerDirectory: () => api.get("/reports/customers"),
  getPaymentList: () => api.get("/reports/payments"),
};
