// Generic CRUD handlers shared by the catalog resources (Hall, Package, Food,
// Decoration, AdditionalService). Each resource's controller binds these to
// its own Model — the business rules (active-only for customers, manager/owner
// for writes) are identical across all five.
import Booking from "../models/Booking.js";

export const listActive = (Model) => async (req, res, next) => {
  try {
    const items = await Model.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

export const getActiveById = (Model) => async (req, res, next) => {
  try {
    const item = await Model.findOne({ _id: req.params.id, isActive: true });
    if (!item) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const listAll = (Model) => async (req, res, next) => {
  try {
    const items = await Model.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

export const createOne = (Model) => async (req, res, next) => {
  try {
    const item = await Model.create(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const updateOne = (Model) => async (req, res, next) => {
  try {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const setActiveStatus = (Model) => async (req, res, next) => {
  try {
    if (typeof req.body.isActive !== "boolean") {
      res.status(400);
      return next(new Error("isActive must be true or false"));
    }
    const item = await Model.findByIdAndUpdate(
      req.params.id,
      { isActive: req.body.isActive },
      { new: true }
    );
    if (!item) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

// Like the hall guard in hall.controller.js: an item that appears in any
// booking can't be hard-deleted, or that booking would silently lose what the
// customer ordered (and paid for). Deactivating hides it from customers
// while keeping the booking intact.
export const deleteOneUnlessBooked = (Model, bookingField, label) => async (req, res, next) => {
  try {
    const bookingCount = await Booking.countDocuments({ [bookingField]: req.params.id });
    if (bookingCount > 0) {
      res.status(409);
      return next(
        new Error(
          `This ${label} is part of ${bookingCount} booking(s) and can't be deleted. Deactivate it instead to hide it from customers.`
        )
      );
    }
    return deleteOne(Model)(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const deleteOne = (Model) => async (req, res, next) => {
  try {
    const item = await Model.findByIdAndDelete(req.params.id);
    if (!item) {
      res.status(404);
      return next(new Error("Not found"));
    }
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
