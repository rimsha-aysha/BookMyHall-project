// The 4 fixed roles for this BookMyHall deployment.
// There is no global super-admin — OWNER is the highest role within a single restaurant deployment.
export const ROLES = Object.freeze({
  CUSTOMER: "customer",
  MANAGER: "manager",
  COORDINATOR: "coordinator",
  OWNER: "owner",
});

export const ALL_ROLES = Object.values(ROLES);
