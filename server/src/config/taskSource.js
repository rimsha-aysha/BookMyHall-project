// Where a PreparationTask came from. SYSTEM tasks are generated from the
// booking's own data (see services/preparationTasks.js) and gate the
// "preparation complete" check. MANUAL tasks were typed in by coordinators
// before generation existed — kept for history, but no longer created and
// never blocking. Documents saved before this field existed read as MANUAL.
export const TASK_SOURCE = Object.freeze({
  SYSTEM: "system",
  MANUAL: "manual",
});

export const ALL_TASK_SOURCES = Object.values(TASK_SOURCE);
