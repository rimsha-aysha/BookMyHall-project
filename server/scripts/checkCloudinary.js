// Verifies the Cloudinary credentials in server/.env without uploading
// anything: authenticates against the Admin API and reports the account's
// usage. Run from the server/ folder:  npm run check:cloudinary
import dotenv from "dotenv";
dotenv.config();

import { isCloudinaryConfigured, getCloudinary, getCloudinaryFolder } from "../src/config/cloudinary.js";

const run = async () => {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must all be set in server/.env"
    );
  }
  const cloudinary = getCloudinary();

  const ping = await cloudinary.api.ping();
  console.log(`Ping: ${ping.status}`);

  // Informational only — API keys with a restricted role may not be allowed
  // to read account usage, which doesn't affect uploading.
  const plan = await cloudinary.api
    .usage()
    .then((usage) => `plan: ${usage.plan}`)
    .catch(() => "plan: not readable with this API key");
  console.log(`Cloud name: ${process.env.CLOUDINARY_CLOUD_NAME} (${plan})`);
  console.log(`Upload folder: ${getCloudinaryFolder()}`);
  console.log("Cloudinary connection OK — credentials are valid.");
};

run().catch((error) => {
  // The SDK reports API failures as { error: { message, http_code } }.
  const detail = error?.error?.message || error.message;
  console.error("Cloudinary check failed:", detail);
  process.exit(1);
});
