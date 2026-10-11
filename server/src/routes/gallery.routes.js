import { Router } from "express";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import {
  galleryCreateRules,
  galleryUpdateRules,
  galleryListRules,
} from "../validators/gallery.validators.js";
import {
  listPublishedGallery,
  getPublishedGalleryById,
  listAllGallery,
  createGalleryEntry,
  updateGalleryEntry,
  setGalleryPublished,
  deleteGalleryEntry,
} from "../controllers/gallery.controller.js";

const router = Router();
const manageOnly = [
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.GALLERY_MANAGEMENT),
];

router.get("/", galleryListRules, validate, listPublishedGallery);
router.get("/manage/all", ...manageOnly, listAllGallery);
router.get("/:id", getPublishedGalleryById);

router.post("/", ...manageOnly, galleryCreateRules, validate, createGalleryEntry);
router.put("/:id", ...manageOnly, galleryUpdateRules, validate, updateGalleryEntry);
router.patch("/:id/publish", ...manageOnly, setGalleryPublished);
router.delete("/:id", ...manageOnly, deleteGalleryEntry);

export default router;
