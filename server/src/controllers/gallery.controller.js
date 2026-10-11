import EventGallery from "../models/EventGallery.js";
import Hall from "../models/Hall.js";

const HALL_POPULATE = { path: "hall", select: "name capacity" };

// Whitelists the editable fields and normalizes empty optional values to
// null, so clearing e.g. the hall or date in the form actually clears it.
const pickGalleryFields = (body) => {
  const fields = {};
  ["title", "description", "eventType", "images", "isPublished"].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  ["hall", "eventDate", "guestCount"].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key] === "" ? null : body[key];
  });
  return fields;
};

const ensureHallExists = async (hallId, res) => {
  if (!hallId) return true;
  const exists = await Hall.exists({ _id: hallId });
  if (!exists) {
    res.status(400);
    return false;
  }
  return true;
};

// Public — published entries only, newest event first. Optional filters:
// ?eventType=Wedding (case-insensitive exact), ?hall=<id>, ?limit=N.
export const listPublishedGallery = async (req, res, next) => {
  try {
    const filter = { isPublished: true };
    if (req.query.hall) filter.hall = req.query.hall;
    if (req.query.eventType) {
      const escaped = req.query.eventType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.eventType = new RegExp(`^${escaped}$`, "i");
    }

    let query = EventGallery.find(filter)
      .sort({ eventDate: -1, createdAt: -1 })
      .populate(HALL_POPULATE)
      .select("-createdBy");
    if (req.query.limit) query = query.limit(Number(req.query.limit));

    const entries = await query;
    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    next(error);
  }
};

export const getPublishedGalleryById = async (req, res, next) => {
  try {
    const entry = await EventGallery.findOne({ _id: req.params.id, isPublished: true })
      .populate(HALL_POPULATE)
      .select("-createdBy");
    if (!entry) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

export const listAllGallery = async (req, res, next) => {
  try {
    const entries = await EventGallery.find({})
      .sort({ createdAt: -1 })
      .populate(HALL_POPULATE)
      .populate("createdBy", "name email");
    res.json({ success: true, count: entries.length, data: entries });
  } catch (error) {
    next(error);
  }
};

export const createGalleryEntry = async (req, res, next) => {
  try {
    const fields = pickGalleryFields(req.body);
    if (!(await ensureHallExists(fields.hall, res))) {
      return next(new Error("Selected hall does not exist"));
    }

    const entry = await EventGallery.create({ ...fields, createdBy: req.user.id });
    await entry.populate(HALL_POPULATE);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

export const updateGalleryEntry = async (req, res, next) => {
  try {
    const fields = pickGalleryFields(req.body);
    if (!(await ensureHallExists(fields.hall, res))) {
      return next(new Error("Selected hall does not exist"));
    }

    const entry = await EventGallery.findByIdAndUpdate(req.params.id, fields, {
      new: true,
      runValidators: true,
    }).populate(HALL_POPULATE);
    if (!entry) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

export const setGalleryPublished = async (req, res, next) => {
  try {
    if (typeof req.body.isPublished !== "boolean") {
      res.status(400);
      return next(new Error("isPublished must be true or false"));
    }
    const entry = await EventGallery.findByIdAndUpdate(
      req.params.id,
      { isPublished: req.body.isPublished },
      { new: true }
    ).populate(HALL_POPULATE);
    if (!entry) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
};

export const deleteGalleryEntry = async (req, res, next) => {
  try {
    const entry = await EventGallery.findByIdAndDelete(req.params.id);
    if (!entry) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
