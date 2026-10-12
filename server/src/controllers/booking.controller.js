import Booking from "../models/Booking.js";
import Hall from "../models/Hall.js";
import Package from "../models/Package.js";
import Food from "../models/Food.js";
import Decoration from "../models/Decoration.js";
import AdditionalService from "../models/AdditionalService.js";
import User from "../models/User.js";
import { ROLES } from "../config/roles.js";
import { BOOKING_STATUS, BOOKING_SOURCE, NON_BLOCKING_BOOKING_STATUSES } from "../config/bookingStatus.js";
import { PREPARATION_STATUS } from "../config/preparationStatus.js";
import { syncPreparationTasks, allRequiredTasksCompleted } from "../services/preparationTasks.js";
import { createKeyedLock } from "../utils/keyedLock.js";

const SELECTION_POPULATE = [
  { path: "customer", select: "name email" },
  { path: "hall", select: "name capacity price" },
  { path: "coordinator", select: "name email" },
  { path: "decidedBy", select: "name email" },
  { path: "package", select: "name price" },
  { path: "food", select: "name price" },
  { path: "decorations", select: "name price" },
  { path: "services", select: "name price" },
];

// Manager/Owner booking details also get the customer's phone number so staff
// can contact them (and who entered a walk-in booking); customers and
// coordinators get SELECTION_POPULATE as-is.
const MANAGEMENT_POPULATE = [
  ...SELECTION_POPULATE.map((p) => (p.path === "customer" ? { ...p, select: "name email phone" } : p)),
  { path: "createdBy", select: "name email" },
];

// Manual manager transitions only. approved -> confirmed happens exclusively
// via a successful payment (see payment.controller.js) and is deliberately
// excluded here so this endpoint can never be used to skip payment.
const MANAGER_STATUS_TRANSITIONS = {
  [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED],
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.UPCOMING],
  [BOOKING_STATUS.UPCOMING]: [BOOKING_STATUS.COMPLETED],
};

// Preparation starts once the advance is paid (approved -> payment ->
// confirmed), so an unpaid approval can't be handed to a coordinator yet.
const COORDINATOR_ASSIGNABLE_STATUSES = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.UPCOMING,
];

// Booking.eventDate is stored/queried at day resolution (time-of-day is
// carried separately in startTime/endTime), so normalize to UTC midnight.
const toDateOnly = (value) => new Date(new Date(value).toISOString().slice(0, 10));

// Single source of truth for the overlap rule, used by both createBooking
// (final safety check) and checkAvailability (pre-submission lookup) — an
// existing (non-rejected) booking for the same hall/date conflicts when it
// starts before the requested end and ends after the requested start.
const findConflictingBooking = (hallId, eventDate, startTime, endTime) =>
  Booking.findOne({
    hall: hallId,
    eventDate,
    status: { $nin: NON_BLOCKING_BOOKING_STATUSES },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });

// Serializes the conflict-check + insert for the same hall/date so two
// simultaneous requests for an overlapping slot can't both pass the check
// before either is saved.
const withHallDateLock = createKeyedLock();

// Time slots already taken (non-rejected bookings) for a hall on a date —
// times only, no customer details — so the customer can pick a free slot.
const findBookedSlots = async (hallId, eventDate) => {
  const bookings = await Booking.find({
    hall: hallId,
    eventDate,
    status: { $nin: NON_BLOCKING_BOOKING_STATUSES },
  })
    .select("startTime endTime")
    .sort({ startTime: 1 });
  return bookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime }));
};

// Prices the given ids against Model, restricted to active documents only —
// never trusts prices from the client. `invalid` is true if any requested id
// doesn't resolve to an active document (bad id, deleted, or deactivated).
const priceActiveItems = async (Model, ids = []) => {
  const uniqueIds = [...new Set(ids.map(String))];
  if (uniqueIds.length === 0) return { total: 0, validIds: [], invalid: false };

  const docs = await Model.find({ _id: { $in: uniqueIds }, isActive: true });
  return {
    total: docs.reduce((sum, doc) => sum + doc.price, 0),
    validIds: docs.map((doc) => doc._id),
    invalid: docs.length !== uniqueIds.length,
  };
};

class BookingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Shared by createBooking (customer, online) and createWalkInBooking
// (manager, at the venue): validates the hall and capacity, prices every
// selection server-side from active catalog items, and inserts under the
// hall/date lock after a final double-booking check. `extra` carries the
// fields that differ between the two (customer/source/status...).
const createPricedBooking = async (body, extra) => {
  const {
    hall: hallId,
    eventType,
    eventDate,
    startTime,
    endTime,
    guestCount,
    requirements,
    package: packageId,
    food = [],
    decorations = [],
    services = [],
  } = body;

  const hall = await Hall.findOne({ _id: hallId, isActive: true });
  if (!hall) throw new BookingError(404, "Selected hall does not exist or is not active");

  if (guestCount > hall.capacity) {
    throw new BookingError(400, `Guest count exceeds hall capacity (${hall.capacity})`);
  }

  const normalizedEventDate = toDateOnly(eventDate);

  // Early, cheap rejection; the authoritative check runs again under the
  // hall/date lock right before insert (see below).
  const earlyConflict = await findConflictingBooking(hall._id, normalizedEventDate, startTime, endTime);
  if (earlyConflict) throw new BookingError(409, "Hall is not available for the selected date and time");

  let packagePrice = 0;
  let validPackageId;
  if (packageId) {
    const pkg = await Package.findOne({ _id: packageId, isActive: true });
    if (!pkg) throw new BookingError(400, "Selected package is invalid or inactive");
    packagePrice = pkg.price;
    validPackageId = pkg._id;
  }

  const foodResult = await priceActiveItems(Food, food);
  if (foodResult.invalid) throw new BookingError(400, "One or more selected food items are invalid or inactive");

  const decorationResult = await priceActiveItems(Decoration, decorations);
  if (decorationResult.invalid) {
    throw new BookingError(400, "One or more selected decoration items are invalid or inactive");
  }

  const serviceResult = await priceActiveItems(AdditionalService, services);
  if (serviceResult.invalid) {
    throw new BookingError(400, "One or more selected additional services are invalid or inactive");
  }

  const estimatedCost =
    hall.price + packagePrice + foodResult.total + decorationResult.total + serviceResult.total;

  const lockKey = `${hall._id}:${normalizedEventDate.toISOString()}`;
  const booking = await withHallDateLock(lockKey, async () => {
    const conflict = await findConflictingBooking(hall._id, normalizedEventDate, startTime, endTime);
    if (conflict) return null;

    return Booking.create({
      hall: hall._id,
      eventType,
      eventDate: normalizedEventDate,
      startTime,
      endTime,
      guestCount,
      requirements,
      package: validPackageId,
      food: foodResult.validIds,
      decorations: decorationResult.validIds,
      services: serviceResult.validIds,
      estimatedCost,
      ...extra,
    });
  });

  if (!booking) throw new BookingError(409, "Hall is not available for the selected date and time");
  return booking;
};

export const createBooking = async (req, res, next) => {
  try {
    const booking = await createPricedBooking(req.body, {
      customer: req.user.id,
      source: BOOKING_SOURCE.ONLINE,
      status: BOOKING_STATUS.PENDING,
    });
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.status);
      return next(new Error(error.message));
    }
    next(error);
  }
};

// Manager/Owner. Books a hall for a customer who came to the venue in
// person — no online account needed; their contact details are stored on
// the booking. Same pricing, availability and double-booking rules as an
// online request. The manager entering it is the one accepting it, so it
// starts APPROVED (attributed to them, like an approval) and then follows
// the normal workflow: an advance payment (recorded offline, or online)
// confirms it, after which a coordinator can be assigned. It starts
// unpaid — creating it never marks anything as paid.
export const createWalkInBooking = async (req, res, next) => {
  try {
    const { customerName, customerPhone, customerEmail } = req.body;
    const now = new Date();
    const booking = await createPricedBooking(req.body, {
      customer: null,
      source: BOOKING_SOURCE.WALK_IN,
      walkInCustomer: {
        name: customerName,
        phone: customerPhone,
        ...(customerEmail && { email: customerEmail }),
      },
      createdBy: req.user.id,
      status: BOOKING_STATUS.APPROVED,
      decidedBy: req.user.id,
      decidedAt: now,
    });
    await booking.populate(MANAGEMENT_POPULATE);
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.status);
      return next(new Error(error.message));
    }
    next(error);
  }
};

// Read-only pre-submission check — reuses findConflictingBooking, the exact
// same rule createBooking enforces as its final safety check.
export const checkAvailability = async (req, res, next) => {
  try {
    const { hall: hallId, eventDate, startTime, endTime } = req.query;

    const hall = await Hall.findOne({ _id: hallId, isActive: true });
    if (!hall) {
      res.status(404);
      return next(new Error("Selected hall does not exist or is not active"));
    }

    const normalizedEventDate = toDateOnly(eventDate);
    const conflict = await findConflictingBooking(hall._id, normalizedEventDate, startTime, endTime);
    const bookedSlots = await findBookedSlots(hall._id, normalizedEventDate);

    // When the requested hall is taken, offer other active halls that are free
    // for the same slot (and big enough, if a guest count was given).
    let alternatives = [];
    if (conflict) {
      const minCapacity = Number(req.query.guestCount) || 1;
      const candidates = await Hall.find({
        _id: { $ne: hall._id },
        isActive: true,
        capacity: { $gte: minCapacity },
      }).sort({ price: 1 });
      for (const candidate of candidates) {
        const taken = await findConflictingBooking(candidate._id, normalizedEventDate, startTime, endTime);
        if (!taken) {
          alternatives.push({
            _id: candidate._id,
            name: candidate.name,
            capacity: candidate.capacity,
            price: candidate.price,
          });
        }
      }
      alternatives = alternatives.slice(0, 3);
    }

    const capacityExceeded = Number(req.query.guestCount) > hall.capacity;

    res.json({
      success: true,
      data: {
        available: !conflict,
        message: conflict
          ? "Hall is not available for the selected date and time"
          : "Hall is available for the selected date and time",
        bookedSlots,
        alternatives,
        capacity: hall.capacity,
        capacityExceeded,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---- Availability calendar ----

// A day counts as fully booked (not offered on the customer calendar) once
// its blocking bookings leave no free gap at least this long. Days with a
// shorter booking stay selectable; findConflictingBooking still decides
// whether the specific time the customer picks is free.
const MIN_FREE_SLOT_MINUTES = 60;
const DAY_END_MINUTES = 23 * 60 + 59; // latest valid HH:mm is 23:59

const toMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const longestFreeGap = (slots) => {
  let cursor = 0;
  let longest = 0;
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const slot of sorted) {
    longest = Math.max(longest, toMinutes(slot.startTime) - cursor);
    cursor = Math.max(cursor, toMinutes(slot.endTime));
  }
  return Math.max(longest, DAY_END_MINUTES - cursor);
};

// "YYYY-MM" -> [first day of month, first day of next month) at UTC
// midnight, matching how eventDate is stored (see toDateOnly).
const monthRange = (month) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthIndex - 1, 1)),
    end: new Date(Date.UTC(year, monthIndex, 1)),
  };
};

const dateKey = (date) => date.toISOString().slice(0, 10);

// Customer-facing month view for one hall. Returns only times and a coarse
// state per slot — never customer, event or price details.
export const getHallAvailability = async (req, res, next) => {
  try {
    const hall = await Hall.findOne({ _id: req.params.hallId, isActive: true }).select("name capacity");
    if (!hall) {
      res.status(404);
      return next(new Error("Selected hall does not exist or is not active"));
    }

    const { start, end } = monthRange(req.query.month);
    const bookings = await Booking.find({
      hall: hall._id,
      eventDate: { $gte: start, $lt: end },
      status: { $nin: NON_BLOCKING_BOOKING_STATUSES },
    })
      .select("eventDate startTime endTime status")
      .sort({ eventDate: 1, startTime: 1 })
      .lean();

    const byDate = new Map();
    for (const booking of bookings) {
      const key = dateKey(booking.eventDate);
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key).push({
        startTime: booking.startTime,
        endTime: booking.endTime,
        // Pending requests still hold the slot (see NON_BLOCKING_BOOKING_STATUSES)
        // but are shown separately since they may yet be rejected.
        state: booking.status === BOOKING_STATUS.PENDING ? "pending" : "booked",
      });
    }

    const days = [...byDate].map(([date, slots]) => ({
      date,
      slots,
      fullyBooked: longestFreeGap(slots) < MIN_FREE_SLOT_MINUTES,
    }));

    res.json({
      success: true,
      data: {
        hall: { _id: hall._id, name: hall.name, capacity: hall.capacity },
        month: req.query.month,
        // Server's "today" — the same reference the booking validators use
        // to reject past dates, so the calendar never offers one.
        today: new Date().toLocaleDateString("en-CA"),
        days,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Staff month view. Manager/Owner see every booking (optionally one hall);
// a Coordinator sees only the bookings assigned to them.
export const getBookingCalendar = async (req, res, next) => {
  try {
    const { start, end } = monthRange(req.query.month);
    const isCoordinator = req.user.role === ROLES.COORDINATOR;

    const filter = { eventDate: { $gte: start, $lt: end } };
    if (req.query.hall) filter.hall = req.query.hall;
    if (isCoordinator) filter.coordinator = req.user.id;

    const hallFilter = isCoordinator
      ? { _id: { $in: await Booking.distinct("hall", { coordinator: req.user.id }) } }
      : {};

    const [bookings, halls] = await Promise.all([
      Booking.find(filter)
        .select("customer hall coordinator eventType eventDate startTime endTime guestCount status")
        .sort({ eventDate: 1, startTime: 1 })
        .populate([
          { path: "customer", select: "name email" },
          { path: "hall", select: "name" },
          { path: "coordinator", select: "name" },
        ]),
      Hall.find(hallFilter).select("name isActive").sort({ name: 1 }),
    ]);

    res.json({
      success: true,
      count: bookings.length,
      data: { month: req.query.month, halls, bookings },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .populate(SELECTION_POPULATE);

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const isManagement = [ROLES.MANAGER, ROLES.OWNER].includes(req.user.role);
    const booking = await Booking.findById(req.params.id).populate(
      isManagement ? MANAGEMENT_POPULATE : SELECTION_POPULATE
    );
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    // customer/coordinator are populated (see SELECTION_POPULATE), so they're
    // User documents here, not bare ObjectIds — compare by _id. Walk-in
    // bookings may have no customer account at all.
    const isOwner = booking.customer?._id?.toString() === req.user.id;
    const isAssignedCoordinator = booking.coordinator?._id?.toString() === req.user.id;
    if (!isOwner && !isAssignedCoordinator && !isManagement) {
      res.status(403);
      return next(new Error("Not authorized to view this booking"));
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const getMyAssignedBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ coordinator: req.user.id })
      .sort({ createdAt: -1 })
      .populate(SELECTION_POPULATE);

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
};

export const listAllBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({}).sort({ createdAt: -1 }).populate(SELECTION_POPULATE);

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    const allowedNextStatuses = MANAGER_STATUS_TRANSITIONS[booking.status] || [];
    if (!allowedNextStatuses.includes(req.body.status)) {
      res.status(400);
      return next(
        new Error(`Cannot change booking status from "${booking.status}" to "${req.body.status}"`)
      );
    }

    // An event can only be marked completed once its date has arrived.
    if (req.body.status === BOOKING_STATUS.COMPLETED) {
      const today = toDateOnly(new Date().toLocaleDateString("en-CA"));
      if (booking.eventDate > today) {
        res.status(400);
        return next(
          new Error("This event hasn't taken place yet — it can be marked completed on or after its event date")
        );
      }
    }

    booking.status = req.body.status;

    // Only approve/reject are decisions to attribute — confirmed/upcoming/
    // completed are downstream lifecycle steps, not a Manager's call.
    if (req.body.status === BOOKING_STATUS.APPROVED || req.body.status === BOOKING_STATUS.REJECTED) {
      booking.decidedBy = req.user.id;
      booking.decidedAt = new Date();
    }

    await booking.save();
    await booking.populate(SELECTION_POPULATE);

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// Coordinator-only. Updates the booking's overall preparation progress.
// Marking it "completed" is the explicit final-check gate: it requires every
// generated preparation task for this booking to already be completed
// (legacy manually created tasks don't block it).
export const updatePreparationStatus = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    if (!booking.coordinator || booking.coordinator.toString() !== req.user.id) {
      res.status(403);
      return next(new Error("You are not the coordinator assigned to this booking"));
    }

    if (req.body.preparationStatus === PREPARATION_STATUS.COMPLETED) {
      // Make sure the gate checks the full generated set, even if the task
      // list was never opened for this booking.
      await syncPreparationTasks(booking);
      if (!(await allRequiredTasksCompleted(booking._id))) {
        res.status(400);
        return next(
          new Error(
            "All required preparation tasks must be completed before marking preparation as complete"
          )
        );
      }
    }

    booking.preparationStatus = req.body.preparationStatus;
    await booking.save();
    await booking.populate(SELECTION_POPULATE);

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const assignCoordinator = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      res.status(404);
      return next(new Error("Booking not found"));
    }

    // Preparation only makes sense once the event is paid for (confirmed),
    // and not after it's over or was rejected.
    if (!COORDINATOR_ASSIGNABLE_STATUSES.includes(booking.status)) {
      res.status(400);
      return next(
        new Error(
          booking.status === BOOKING_STATUS.APPROVED
            ? "A coordinator can be assigned once the customer has paid the advance and the booking is confirmed"
            : `A coordinator can only be assigned to confirmed or upcoming bookings (this one is "${booking.status}")`
        )
      );
    }

    const coordinator = await User.findOne({
      _id: req.body.coordinatorId,
      role: ROLES.COORDINATOR,
    });
    if (!coordinator) {
      res.status(400);
      return next(new Error("Selected user is not a valid coordinator"));
    }
    if (coordinator.isActive === false) {
      res.status(400);
      return next(new Error("Selected coordinator account is deactivated"));
    }

    booking.coordinator = coordinator._id;
    await booking.save();
    // The coordinator starts with a ready-made checklist built from this
    // booking's hall, package, food, decorations, services and requirements.
    await syncPreparationTasks(booking);
    await booking.populate(SELECTION_POPULATE);

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};
