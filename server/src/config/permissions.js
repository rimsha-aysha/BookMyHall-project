// The set of Manager-facing capabilities the Owner can individually grant or
// revoke. Every existing Manager keeps full access by default (see
// models/User.js) — this only lets an Owner narrow it per account.
export const PERMISSIONS = Object.freeze({
  BOOKING_MANAGEMENT: "bookingManagement",
  CATALOG_MANAGEMENT: "catalogManagement",
  COORDINATOR_MANAGEMENT: "coordinatorManagement",
  PAYMENT_VIEWING: "paymentViewing",
  // Record and confirm offline (cash/UPI/bank transfer) payments.
  PAYMENT_RECORDING: "paymentRecording",
  PREPARATION_MONITORING: "preparationMonitoring",
  ISSUE_MANAGEMENT: "issueManagement",
  GALLERY_MANAGEMENT: "galleryManagement",
});

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
