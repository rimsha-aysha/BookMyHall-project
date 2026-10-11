import { Router } from "express";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import multer from "multer";
import { protect, authorize, requireAnyPermission } from "../middleware/auth.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";

import { isCloudinaryConfigured, uploadImageBuffer } from "../config/cloudinary.js";

// When Cloudinary credentials are set in .env, uploaded images are stored on
// Cloudinary and the endpoint returns their permanent https URLs. Otherwise
// they're saved to local disk under server/uploads, served statically at
// /uploads (see app.js), and returned root-relative ("/uploads/<file>") so
// they survive a host/port change; the client resolves those against the API
// origin. Previously stored local paths and plain external URLs keep working
// either way.
export const UPLOAD_DIR = fileURLToPath(new URL("../../uploads", import.meta.url));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MAX_FILES = 10;

const uploadOptions = {
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
    }
    cb(null, true);
  },
};

const diskUpload = multer({
  ...uploadOptions,
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ALLOWED_TYPES[file.mimetype]}`),
  }),
});

// Held in memory only long enough to stream to Cloudinary.
const memoryUpload = multer({ ...uploadOptions, storage: multer.memoryStorage() });

const router = Router();

// Halls (catalog) and the event gallery both upload through here, so a
// Manager needs either of those permissions.
router.post(
  "/images",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requireAnyPermission(PERMISSIONS.CATALOG_MANAGEMENT, PERMISSIONS.GALLERY_MANAGEMENT),
  (req, res, next) => {
    const useCloudinary = isCloudinaryConfigured();
    const upload = useCloudinary ? memoryUpload : diskUpload;
    upload.array("images", MAX_FILES)(req, res, async (err) => {
      if (err) {
        res.status(400);
        return next(
          err.code === "LIMIT_FILE_SIZE" ? new Error("Each image must be 5 MB or smaller") : err
        );
      }
      if (!req.files || req.files.length === 0) {
        res.status(400);
        return next(new Error("No images were uploaded"));
      }
      if (useCloudinary) {
        try {
          const results = await Promise.all(req.files.map((f) => uploadImageBuffer(f.buffer)));
          return res.status(201).json({ success: true, data: results.map((r) => r.secure_url) });
        } catch (uploadError) {
          console.error("Cloudinary upload failed:", uploadError.message);
          res.status(502);
          return next(new Error("Image upload to cloud storage failed. Please try again."));
        }
      }
      res.status(201).json({
        success: true,
        data: req.files.map((f) => `/uploads/${f.filename}`),
      });
    });
  }
);

export default router;
