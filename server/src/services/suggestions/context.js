import Hall from "../../models/Hall.js";
import Package from "../../models/Package.js";
import Food from "../../models/Food.js";
import Decoration from "../../models/Decoration.js";
import AdditionalService from "../../models/AdditionalService.js";
import Booking from "../../models/Booking.js";
import EventGallery from "../../models/EventGallery.js";
import { BOOKING_STATUS } from "../../config/bookingStatus.js";

const toDateOnly = (value) => new Date(new Date(value).toISOString().slice(0, 10));

// Everything a suggestion provider is allowed to recommend from: the live,
// active catalog plus a little history. Providers must only return ids that
// exist in this context (enforced in index.js).
export const loadSuggestionContext = async (input) => {
  const [halls, packages, foods, decorations, services, pastBookings, galleryEntries] =
    await Promise.all([
      Hall.find({ isActive: true }).lean(),
      Package.find({ isActive: true }).lean(),
      Food.find({ isActive: true }).lean(),
      Decoration.find({ isActive: true }).lean(),
      AdditionalService.find({ isActive: true }).lean(),
      Booking.find({ status: { $ne: BOOKING_STATUS.REJECTED } })
        .select("hall eventType package")
        .lean(),
      EventGallery.find({ isPublished: true }).select("hall eventType").lean(),
    ]);

  // Hall ids already taken for the requested slot (same overlap rule as
  // booking.controller's findConflictingBooking).
  let unavailableHallIds = null;
  if (input.eventDate && input.startTime && input.endTime) {
    const conflicts = await Booking.find({
      eventDate: toDateOnly(input.eventDate),
      status: { $ne: BOOKING_STATUS.REJECTED },
      startTime: { $lt: input.endTime },
      endTime: { $gt: input.startTime },
    })
      .select("hall")
      .lean();
    unavailableHallIds = new Set(conflicts.map((b) => b.hall.toString()));
  }

  return {
    halls,
    packages,
    foods,
    decorations,
    services,
    history: { pastBookings, galleryEntries },
    unavailableHallIds,
  };
};
