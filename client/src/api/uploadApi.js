import api from "./axiosInstance.js";

// Returns the stored URLs of the uploaded images: Cloudinary https URLs, or
// "/uploads/<file>" paths when the server stores uploads locally.
export const uploadImages = (files) => {
  const formData = new FormData();
  [...files].forEach((file) => formData.append("images", file));
  return api.post("/uploads/images", formData);
};
