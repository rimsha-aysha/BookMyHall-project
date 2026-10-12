import { Router } from "express";
import { protect, authorize, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../config/roles.js";
import { PERMISSIONS } from "../config/permissions.js";
import {
  bookingCreateRules,
  bookingStatusUpdateRules,
  assignCoordinatorRules,
  preparationStatusUpdateRules,
  checkAvailabilityRules,
  hallAvailabilityRules,
  bookingCalendarRules,
  walkInBookingRules,
} from "../validators/booking.validators.js";
import {
  createBooking,
  getMyBookings,
  getBookingById,
  listAllBookings,
  updateBookingStatus,
  assignCoordinator,
  getMyAssignedBookings,
  updatePreparationStatus,
  checkAvailability,
  getHallAvailability,
  getBookingCalendar,
  createWalkInBooking,
} from "../controllers/booking.controller.js";

const router = Router();
const manageOnly = [protect, authorize(ROLES.MANAGER, ROLES.OWNER)];
const bookingManageOnly = [...manageOnly, requirePermission(PERMISSIONS.BOOKING_MANAGEMENT)];
const coordinatorManageOnly = [...manageOnly, requirePermission(PERMISSIONS.COORDINATOR_MANAGEMENT)];

router.post("/", protect, authorize(ROLES.CUSTOMER), bookingCreateRules, validate, createBooking);
router.get("/my", protect, authorize(ROLES.CUSTOMER), getMyBookings);

// Walk-in booking entered by staff for a customer at the venue (who may have
// no online account). Same booking-management gate as reviewing requests.
router.post("/walk-in", ...bookingManageOnly, walkInBookingRules, validate, createWalkInBooking);
router.get("/manage/all", ...bookingManageOnly, listAllBookings);
router.get("/coordinator/my", protect, authorize(ROLES.COORDINATOR), getMyAssignedBookings);

// Must be registered before "/:id" — both are single-segment GET routes and
// "/:id" would otherwise swallow this path and try to treat it as a booking id.
// Also used by staff entering a walk-in booking (booking management only).
router.get(
  "/check-availability",
  protect,
  authorize(ROLES.CUSTOMER, ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.BOOKING_MANAGEMENT),
  checkAvailabilityRules,
  validate,
  checkAvailability
);

// Customer availability calendar for one hall/month — slot times only, no
// customer details. Two segments, so it can't collide with "/:id".
router.get(
  "/availability/:hallId",
  protect,
  authorize(ROLES.CUSTOMER, ROLES.MANAGER, ROLES.OWNER),
  requirePermission(PERMISSIONS.BOOKING_MANAGEMENT),
  hallAvailabilityRules,
  validate,
  getHallAvailability
);

// Staff booking calendar. Managers need booking management (same gate as
// /manage/all); coordinators are scoped to their own assignments in the
// controller. Must also sit before "/:id".
router.get(
  "/calendar",
  protect,
  authorize(ROLES.MANAGER, ROLES.OWNER, ROLES.COORDINATOR),
  requirePermission(PERMISSIONS.BOOKING_MANAGEMENT),
  bookingCalendarRules,
  validate,
  getBookingCalendar
);

// Authorization here is done inside the controller (owning customer, or
// manager/owner) rather than at the route, so it can be extended later
// (e.g. an assigned coordinator) without restructuring this route.
router.get("/:id", protect, getBookingById);

router.patch("/:id/status", ...bookingManageOnly, bookingStatusUpdateRules, validate, updateBookingStatus);
router.patch(
  "/:id/coordinator",
  ...coordinatorManageOnly,
  assignCoordinatorRules,
  validate,
  assignCoordinator
);
router.patch(
  "/:id/preparation-status",
  protect,
  authorize(ROLES.COORDINATOR),
  preparationStatusUpdateRules,
  validate,
  updatePreparationStatus
);

export default router;
