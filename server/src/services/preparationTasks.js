import Booking from "../models/Booking.js";
import Hall from "../models/Hall.js";
import Package from "../models/Package.js";
import Food from "../models/Food.js";
import Decoration from "../models/Decoration.js";
import AdditionalService from "../models/AdditionalService.js";
import PreparationTask from "../models/PreparationTask.js";
import { TASK_CATEGORY } from "../config/taskCategory.js";
import { TASK_STATUS } from "../config/taskStatus.js";
import { TASK_SOURCE } from "../config/taskSource.js";
import { PREPARATION_STATUS } from "../config/preparationStatus.js";

// Preparation tasks are generated from the booking's own data, never typed
// in by the coordinator. Each task has a stable `key`, so generation is
// idempotent: it runs on coordinator assignment and again whenever tasks are
// read (which also backfills bookings assigned before generation existed).

// "Biryani, Raita" — or "Biryani (+1 no longer in catalog)" when a selected
// item has since been deleted, so the count still matches the booking.
const describeItems = (docs, selectedCount, withCategory = false) => {
  const names = docs.map((d) => (withCategory && d.category ? `${d.name} (${d.category})` : d.name));
  const missing = selectedCount - docs.length;
  if (missing > 0) names.push(`+${missing} no longer in catalog`);
  return names.join(", ");
};

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Pure: booking + its resolved catalog documents -> the tasks it needs.
// Food/decoration/service tasks appear only when the booking selected at
// least one item of that kind; the requirements task only when the customer
// wrote some.
export const buildPreparationTasks = ({ booking, hall, pkg, foods = [], decorations = [], services = [] }) => {
  const eventDate = new Date(booking.eventDate).toISOString().slice(0, 10);
  const when = `${eventDate}, ${booking.startTime}–${booking.endTime}`;
  const guests = plural(booking.guestCount, "guest");
  const hallName = hall?.name || "the booked hall";

  const tasks = [
    {
      key: "hall_setup:confirm_setup",
      category: TASK_CATEGORY.HALL_SETUP,
      title: "Confirm hall setup",
      description: "Confirm the hall is reserved, clean and ready for the event.",
      reason: `Every booking needs its hall prepared — ${hallName} for a ${booking.eventType} on ${when}.`,
    },
    {
      key: "hall_setup:tables_chairs",
      category: TASK_CATEGORY.HALL_SETUP,
      title: "Check tables and chairs",
      description: "Make sure there are enough tables and chairs, in good condition.",
      reason: `Booking is for ${guests}${hall?.capacity ? ` (hall capacity ${hall.capacity})` : ""}.`,
    },
    {
      key: "hall_setup:seating",
      category: TASK_CATEGORY.HALL_SETUP,
      title: "Check seating arrangement",
      description: "Arrange the seating layout to suit the event.",
      reason: `Seating needed for ${guests} at a ${booking.eventType}.`,
    },
  ];

  if (booking.package) {
    tasks.push({
      key: "hall_setup:package_inclusions",
      category: TASK_CATEGORY.HALL_SETUP,
      title: "Verify package inclusions",
      description: "Check that everything included in the booked package is arranged.",
      reason: pkg
        ? `Customer booked the "${pkg.name}" package${
            pkg.includedItems?.length ? `, which includes: ${pkg.includedItems.join(", ")}` : ""
          }.`
        : "Customer booked a package (no longer in catalog).",
    });
  }

  const foodCount = booking.food?.length || 0;
  if (foodCount > 0) {
    const items = describeItems(foods, foodCount);
    tasks.push(
      {
        key: "food:confirm_arrangement",
        category: TASK_CATEGORY.FOOD,
        title: "Confirm food arrangement",
        description: "Confirm the selected menu with the kitchen/caterer.",
        reason: `Customer selected ${plural(foodCount, "food item")}: ${items}.`,
      },
      {
        key: "food:verify_quantity",
        category: TASK_CATEGORY.FOOD,
        title: "Verify food quantity",
        description: "Make sure the food quantity covers every guest.",
        reason: `Food must cover ${guests}.`,
      },
      {
        key: "food:serving_setup",
        category: TASK_CATEGORY.FOOD,
        title: "Confirm serving setup",
        description: "Set up serving counters, utensils and serving staff.",
        reason: `Food will be served during the event (${when}).`,
      }
    );
  }

  const decorationCount = booking.decorations?.length || 0;
  if (decorationCount > 0) {
    tasks.push(
      {
        key: "decorations:confirm_arrangement",
        category: TASK_CATEGORY.DECORATIONS,
        title: "Confirm decoration arrangement",
        description: "Confirm the decoration order and setup time with the decorator.",
        reason: `Customer selected ${plural(decorationCount, "decoration")}.`,
      },
      {
        key: "decorations:verify_theme",
        category: TASK_CATEGORY.DECORATIONS,
        title: "Verify selected decoration/theme",
        description: "Check the decorations match exactly what the customer selected.",
        reason: `Selected: ${describeItems(decorations, decorationCount, true)}.`,
      },
      {
        key: "decorations:complete_setup",
        category: TASK_CATEGORY.DECORATIONS,
        title: "Complete decoration setup",
        description: "Finish installing the decorations before the event starts.",
        reason: `Decorations must be ready in ${hallName} before ${booking.startTime} on ${eventDate}.`,
      }
    );
  }

  const serviceCount = booking.services?.length || 0;
  if (serviceCount > 0) {
    const items = describeItems(services, serviceCount);
    tasks.push(
      {
        key: "additional_services:confirm_requirements",
        category: TASK_CATEGORY.ADDITIONAL_SERVICES,
        title: "Confirm service requirements",
        description: "Confirm what each selected service needs for this event.",
        reason: `Customer selected ${plural(serviceCount, "additional service")}: ${items}.`,
      },
      {
        key: "additional_services:verify_availability",
        category: TASK_CATEGORY.ADDITIONAL_SERVICES,
        title: "Verify staff/service availability",
        description: "Make sure the staff/vendors for each service are booked and available.",
        reason: `Needed on ${when}: ${items}.`,
      },
      {
        key: "additional_services:complete_setup",
        category: TASK_CATEGORY.ADDITIONAL_SERVICES,
        title: "Complete service setup",
        description: "Set up each service before the event starts.",
        reason: `Services must be ready before ${booking.startTime} on ${eventDate}.`,
      }
    );
  }

  const requirements = booking.requirements?.trim();
  if (requirements) {
    tasks.push({
      key: "customer_requirements:verify",
      category: TASK_CATEGORY.CUSTOMER_REQUIREMENTS,
      title: "Verify customer requirements",
      description: "Make sure every special requirement from the customer is arranged.",
      reason: `Customer requested: "${requirements}"`,
    });
  }

  return tasks;
};

const isDuplicateKeyError = (error) =>
  error?.code === 11000 ||
  (error?.writeErrors && [].concat(error.writeErrors).every((w) => w.code === 11000));

// Creates any missing generated tasks for the booking and refreshes the text
// of existing ones. Never touches a task's status. Safe to call repeatedly
// and concurrently: the unique (booking, key) index rejects any duplicate.
export const syncPreparationTasks = async (bookingOrId) => {
  const booking =
    bookingOrId instanceof Booking ? bookingOrId : await Booking.findById(bookingOrId);
  if (!booking || !booking.coordinator) return;

  const [hall, pkg, foods, decorations, services] = await Promise.all([
    Hall.findById(booking.hall).select("name capacity"),
    booking.package ? Package.findById(booking.package).select("name includedItems") : null,
    Food.find({ _id: { $in: booking.food } }).select("name category"),
    Decoration.find({ _id: { $in: booking.decorations } }).select("name category"),
    AdditionalService.find({ _id: { $in: booking.services } }).select("name category"),
  ]);

  const blueprint = buildPreparationTasks({ booking, hall, pkg, foods, decorations, services });

  // A booking already signed off under the old manual workflow keeps its
  // sign-off: its backfilled tasks start completed rather than reopening it.
  const initialStatus =
    booking.preparationStatus === PREPARATION_STATUS.COMPLETED ? TASK_STATUS.COMPLETED : TASK_STATUS.PENDING;

  // Timestamps are set on insert only — re-syncing unchanged text on every
  // page view must not bump updatedAt.
  const now = new Date();
  const ops = blueprint.map(({ key, category, title, description, reason }) => ({
    updateOne: {
      filter: { booking: booking._id, key },
      update: {
        $set: { category, title, description, reason, source: TASK_SOURCE.SYSTEM },
        $setOnInsert: { coordinator: booking.coordinator, status: initialStatus, createdAt: now, updatedAt: now },
      },
      upsert: true,
    },
  }));

  try {
    await PreparationTask.bulkWrite(ops, { ordered: false, timestamps: false });
  } catch (error) {
    // A concurrent sync inserted the same task first — that's the outcome we want.
    if (!isDuplicateKeyError(error)) throw error;
  }

  // Unfinished work moves with the booking when it's reassigned.
  await PreparationTask.updateMany(
    {
      booking: booking._id,
      source: TASK_SOURCE.SYSTEM,
      status: { $ne: TASK_STATUS.COMPLETED },
      coordinator: { $ne: booking.coordinator },
    },
    { coordinator: booking.coordinator }
  );
};

// The "preparation complete" gate: every generated task done. Legacy manual
// tasks don't count either way.
export const allRequiredTasksCompleted = async (bookingId) => {
  const tasks = await PreparationTask.find({ booking: bookingId, source: TASK_SOURCE.SYSTEM }).select("status");
  return tasks.length > 0 && tasks.every((task) => task.status === TASK_STATUS.COMPLETED);
};
