import { v2 as cloudinary } from "cloudinary";

// Credentials come only from the environment (server/.env), never the code:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// Read lazily rather than at import time: ES imports are evaluated before
// server.js gets to call dotenv.config().

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );

// Uploaded images go into this folder of the Cloudinary media library.
export const getCloudinaryFolder = () => process.env.CLOUDINARY_FOLDER || "bookmyhall";

let configured = false;
export const getCloudinary = () => {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
};

// Uploads one in-memory image; resolves to Cloudinary's upload result
// (secure_url is the permanent https URL that gets stored in the database).
export const uploadImageBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(
      { folder: getCloudinaryFolder(), resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
