// Overall event-preparation progress for a booking, set by its assigned
// coordinator — distinct from Booking.status (the manager-driven business
// lifecycle) and from individual PreparationTask statuses.
export const PREPARATION_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
});

export const ALL_PREPARATION_STATUSES = Object.values(PREPARATION_STATUS);
