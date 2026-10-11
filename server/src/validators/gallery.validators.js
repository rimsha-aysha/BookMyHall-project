import { body, query } from "express-validator";

// An image is either an uploaded file ("/uploads/<file>") or an absolute
// http(s) URL — the same two forms Hall.images accepts.
export const isImageRef = (value) =>
  typeof value === "string" && (/^\/uploads\/[\w.-]+$/.test(value) || /^https?:\/\/\S+$/i.test(value));

const imagesRule = (optional) => {
  const chain = body("images");
  return (optional ? chain.optional() : chain)
    .isArray({ min: 1, max: 30 })
    .withMessage("Add between 1 and 30 photos")
    .bail()
    .custom((images) => {
      if (!images.every(isImageRef)) {
        throw new Error("Each photo must be an uploaded image or an http(s) URL");
      }
      return true;
    });
};

const sharedOptionalRules = [
  body("description").optional().isString(),
  body("hall")
    .optional({ values: "falsy" })
    .isMongoId()
    .withMessage("Invalid hall id"),
  body("eventDate")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("Event date must be a valid date"),
  body("guestCount")
    .optional({ values: "falsy" })
    .isInt({ min: 1 })
    .withMessage("Guest count must be a positive number"),
  body("isPublished").optional().isBoolean().withMessage("isPublished must be true or false"),
];

export const galleryCreateRules = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("eventType").trim().notEmpty().withMessage("Event type is required"),
  imagesRule(false),
  ...sharedOptionalRules,
];

export const galleryUpdateRules = [
  body("title").optional().trim().notEmpty().withMessage("Title cannot be empty"),
  body("eventType").optional().trim().notEmpty().withMessage("Event type cannot be empty"),
  imagesRule(true),
  ...sharedOptionalRules,
];

export const galleryListRules = [
  query("hall").optional().isMongoId().withMessage("Invalid hall id"),
  query("eventType").optional().isString(),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit must be 1-100"),
];
