// API tests for walk-in bookings and offline payments, run against an
// in-memory MongoDB (no real database or Razorpay account is touched; the
// Razorpay client is stubbed with the responses its API would return).
//   npm test
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_SECRET = "test-secret";
process.env.RAZORPAY_KEY_ID = "rzp_test_dummykey";
process.env.RAZORPAY_KEY_SECRET = "dummy_secret";
process.env.NODE_ENV = "production"; // silences request logging

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Hall } = await import("../src/models/Hall.js");
const { default: Booking } = await import("../src/models/Booking.js");
const { default: Payment } = await import("../src/models/Payment.js");
const { default: Food } = await import("../src/models/Food.js");
const { generateToken } = await import("../src/utils/generateToken.js");
const { getRazorpay, toPaise } = await import("../src/config/razorpay.js");
const { runPaymentMigrations } = await import("../src/services/paymentLedger.js");

let mongo;
const tokens = {};
const users = {};
let hall;
let food;
let slot = 0;

// Each booking gets its own future date so slots never collide by accident.
const nextDate = () => {
  slot += 1;
  const d = new Date();
  d.setDate(d.getDate() + 30 + slot);
  return d.toLocaleDateString("en-CA");
};

const auth = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

const walkInBody = (overrides = {}) => ({
  hall: hall._id.toString(),
  eventType: "Birthday",
  eventDate: nextDate(),
  startTime: "18:00",
  endTime: "22:00",
  guestCount: 50,
  requirements: "Cake table",
  food: [food._id.toString()],
  customerName: "Walk-in Guest",
  customerPhone: "98765 43210",
  ...overrides,
});

// Hall 10000 + food 2000 = 12000 total; 50% advance = 6000.
const TOTAL = 12000;
const ADVANCE = 6000;

const createWalkIn = async (overrides) => {
  const res = await request(app).post("/api/bookings/walk-in").set(auth("manager")).send(walkInBody(overrides));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
};

const recordOffline = (bookingId, body, who = "manager") =>
  request(app)
    .post(`/api/payments/booking/${bookingId}/offline`)
    .set(auth(who))
    .send({ method: "cash", paymentDate: new Date().toLocaleDateString("en-CA"), ...body });

const confirmOffline = (paymentId, who = "manager") =>
  request(app).post(`/api/payments/offline/${paymentId}/confirm`).set(auth(who)).send({});

const summary = async (bookingId, who = "manager") => {
  const res = await request(app).get(`/api/payments/booking/${bookingId}`).set(auth(who));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data;
};

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await runPaymentMigrations();

  const mk = async (key, role, extra = {}) => {
    users[key] = await User.create({
      name: `${key} user`,
      email: `${key}@test.local`,
      password: "secret123",
      role,
      ...(role === "customer" && { phone: "9123456780" }),
      ...extra,
    });
    tokens[key] = generateToken(users[key]);
  };
  await mk("owner", "owner");
  await mk("manager", "manager");
  await mk("limitedManager", "manager", { permissions: { paymentRecording: false } });
  await mk("noBookingsManager", "manager", { permissions: { bookingManagement: false } });
  await mk("coordinator", "coordinator");
  await mk("customer", "customer");
  await mk("otherCustomer", "customer");

  hall = await Hall.create({ name: "Grand Hall", capacity: 200, price: 10000 });
  food = await Food.create({ name: "Buffet", price: 2000, category: "Mains" });
});

after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe("walk-in booking", () => {
  test("is created without an online customer account, priced on the server, unpaid", async () => {
    const booking = await createWalkIn({ estimatedCost: 1 }); // client price is ignored
    assert.equal(booking.source, "walk_in");
    assert.equal(booking.customer, null);
    assert.equal(booking.walkInCustomer.name, "Walk-in Guest");
    assert.equal(booking.walkInCustomer.phone, "9876543210");
    assert.equal(booking.estimatedCost, TOTAL);
    assert.equal(booking.status, "approved");
    assert.equal(booking.decidedBy._id || booking.decidedBy, users.manager._id.toString());
    assert.equal(booking.createdBy.name, "manager user");
    assert.equal(booking.paymentStatus, "unpaid");
    assert.equal(booking.amountPaid, 0);

    const s = await summary(booking._id);
    assert.equal(s.totalPaid, 0);
    assert.equal(s.remainingBalance, TOTAL);
    assert.equal(s.paymentStatus, "unpaid");
    assert.deepEqual(s.payments, []);
  });

  test("reuses double-booking prevention", async () => {
    const date = nextDate();
    await createWalkIn({ eventDate: date });
    const res = await request(app)
      .post("/api/bookings/walk-in")
      .set(auth("manager"))
      .send(walkInBody({ eventDate: date, startTime: "20:00", endTime: "23:00" }));
    assert.equal(res.status, 409);
  });

  test("validates customer details and capacity", async () => {
    const badPhone = await request(app).post("/api/bookings/walk-in").set(auth("manager")).send(walkInBody({ customerPhone: "12345" }));
    assert.equal(badPhone.status, 400);
    const noName = await request(app).post("/api/bookings/walk-in").set(auth("manager")).send(walkInBody({ customerName: "  " }));
    assert.equal(noName.status, 400);
    const badEmail = await request(app).post("/api/bookings/walk-in").set(auth("manager")).send(walkInBody({ customerEmail: "nope" }));
    assert.equal(badEmail.status, 400);
    const tooMany = await request(app).post("/api/bookings/walk-in").set(auth("manager")).send(walkInBody({ guestCount: 500 }));
    assert.equal(tooMany.status, 400);
  });

  test("is restricted to staff with booking management", async () => {
    for (const who of ["customer", "coordinator", "noBookingsManager"]) {
      const res = await request(app).post("/api/bookings/walk-in").set(auth(who)).send(walkInBody());
      assert.equal(res.status, 403, who);
    }
    const anon = await request(app).post("/api/bookings/walk-in").send(walkInBody());
    assert.equal(anon.status, 401);
    const owner = await request(app).post("/api/bookings/walk-in").set(auth("owner")).send(walkInBody());
    assert.equal(owner.status, 201);
  });

  test("appears in the manager list with its source, and follows the coordinator workflow", async () => {
    const booking = await createWalkIn();
    const list = await request(app).get("/api/bookings/manage/all").set(auth("manager"));
    const row = list.body.data.find((b) => b._id === booking._id);
    assert.equal(row.source, "walk_in");
    assert.equal(row.walkInCustomer.name, "Walk-in Guest");

    // Not assignable until the advance confirms it — same rule as online.
    const early = await request(app)
      .patch(`/api/bookings/${booking._id}/coordinator`)
      .set(auth("manager"))
      .send({ coordinatorId: users.coordinator._id.toString() });
    assert.equal(early.status, 400);

    const rec = await recordOffline(booking._id, { amount: ADVANCE, confirmReceived: true });
    assert.equal(rec.status, 201);
    const assigned = await request(app)
      .patch(`/api/bookings/${booking._id}/coordinator`)
      .set(auth("manager"))
      .send({ coordinatorId: users.coordinator._id.toString() });
    assert.equal(assigned.status, 200);
  });
});

describe("offline payments", () => {
  test("advance: recorded unconfirmed doesn't count; confirming it confirms the booking (partially paid)", async () => {
    const booking = await createWalkIn();
    const rec = await recordOffline(booking._id, { amount: ADVANCE, notes: "Paid at front desk" });
    assert.equal(rec.status, 201, JSON.stringify(rec.body));
    const payment = rec.body.data.payment;
    assert.equal(payment.status, "pending");
    assert.equal(payment.gateway, "offline");
    assert.equal(payment.recordedBy.name, "manager user");
    assert.equal(payment.confirmedBy, undefined);

    let b = await Booking.findById(booking._id);
    assert.equal(b.status, "approved");
    assert.equal(b.paymentStatus, "unpaid");
    assert.equal(b.amountPaid, 0);

    const conf = await confirmOffline(payment._id);
    assert.equal(conf.status, 200, JSON.stringify(conf.body));
    assert.equal(conf.body.data.payment.status, "success");
    assert.equal(conf.body.data.payment.confirmedBy.name, "manager user");
    assert.ok(conf.body.data.payment.confirmedAt);

    b = await Booking.findById(booking._id);
    assert.equal(b.status, "confirmed");
    assert.equal(b.paymentStatus, "partially_paid", "advance alone must not mark the booking paid");
    assert.equal(b.amountPaid, ADVANCE);

    const s = await summary(booking._id);
    assert.equal(s.totalPaid, ADVANCE);
    assert.equal(s.remainingBalance, TOTAL - ADVANCE);
    assert.equal(s.advanceDue, 0);
  });

  test("multiple offline payments, then the full balance marks it paid", async () => {
    const booking = await createWalkIn();
    const p1 = await recordOffline(booking._id, { amount: 2000, confirmReceived: true });
    assert.equal(p1.status, 201);
    let b = await Booking.findById(booking._id);
    assert.equal(b.status, "approved", "below the advance the booking stays approved");
    assert.equal(b.paymentStatus, "partially_paid");

    const p2 = await recordOffline(booking._id, { amount: 4000, method: "upi", reference: "UPI123456789012", confirmReceived: true });
    assert.equal(p2.status, 201, JSON.stringify(p2.body));
    b = await Booking.findById(booking._id);
    assert.equal(b.status, "confirmed");
    assert.equal(b.paymentStatus, "partially_paid");

    const p3 = await recordOffline(booking._id, { amount: 6000, method: "bank_transfer", reference: "UTR-NEFT-998877" });
    assert.equal(p3.status, 201);
    assert.equal((await Booking.findById(booking._id)).paymentStatus, "partially_paid");
    const c3 = await confirmOffline(p3.body.data.payment._id);
    assert.equal(c3.status, 200);

    b = await Booking.findById(booking._id);
    assert.equal(b.paymentStatus, "paid");
    assert.equal(b.amountPaid, TOTAL);
    const s = await summary(booking._id);
    assert.equal(s.remainingBalance, 0);
    assert.equal(s.payments.length, 3);

    const more = await recordOffline(booking._id, { amount: 1 });
    assert.equal(more.status, 409, "nothing more can be recorded once fully paid");
  });

  test("rejects invalid amounts and fields", async () => {
    const booking = await createWalkIn();
    for (const amount of [0, -100, 10.5, "abc", null, TOTAL + 1]) {
      const res = await recordOffline(booking._id, { amount });
      assert.equal(res.status, 400, `amount ${amount}`);
    }
    const noMethod = await recordOffline(booking._id, { amount: 100, method: "crypto" });
    assert.equal(noMethod.status, 400);
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const futureDate = await recordOffline(booking._id, { amount: 100, paymentDate: future.toLocaleDateString("en-CA") });
    assert.equal(futureDate.status, 400);
    const upiNoRef = await recordOffline(booking._id, { amount: 100, method: "upi" });
    assert.equal(upiNoRef.status, 400, "UPI requires a reference");
    const pinLike = await recordOffline(booking._id, { amount: 100, method: "upi", reference: "1234" });
    assert.equal(pinLike.status, 400, "a 4-digit value (PIN-like) is not a valid reference");
    const badBooking = await recordOffline("not-an-id", { amount: 100 });
    assert.equal(badBooking.status, 400);
    const missing = await recordOffline(new mongoose.Types.ObjectId().toString(), { amount: 100 });
    assert.equal(missing.status, 404);

    // Pending records reserve their amount: can't record more than is owed.
    const big = await recordOffline(booking._id, { amount: TOTAL - 1000 });
    assert.equal(big.status, 201);
    const over = await recordOffline(booking._id, { amount: 1001 });
    assert.equal(over.status, 400);
    assert.equal((await Payment.countDocuments({ booking: booking._id })), 1, "nothing stored for rejected requests");
  });

  test("rejects duplicate submissions and double confirmation", async () => {
    const booking = await createWalkIn();
    const key = crypto.randomUUID();
    const first = await recordOffline(booking._id, { amount: 1000, idempotencyKey: key });
    assert.equal(first.status, 201);
    const again = await recordOffline(booking._id, { amount: 1000, idempotencyKey: key });
    assert.equal(again.status, 409);

    // Same request fired concurrently (double-click) — only one record.
    const key2 = crypto.randomUUID();
    const results = await Promise.all([
      recordOffline(booking._id, { amount: 500, idempotencyKey: key2 }),
      recordOffline(booking._id, { amount: 500, idempotencyKey: key2 }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);

    // The same bank reference can't be recorded twice (any booking, any spacing/case).
    const ref = await recordOffline(booking._id, { amount: 100, method: "bank_transfer", reference: "UTR 5555 6666" });
    assert.equal(ref.status, 201);
    const other = await createWalkIn();
    const dupRef = await recordOffline(other._id, { amount: 100, method: "bank_transfer", reference: "utr55556666" });
    assert.equal(dupRef.status, 409);

    // Concurrent confirms of the same record count it once.
    const pid = first.body.data.payment._id;
    const confirms = await Promise.all([confirmOffline(pid), confirmOffline(pid)]);
    assert.deepEqual(confirms.map((r) => r.status).sort(), [200, 409]);
    const s = await summary(booking._id);
    assert.equal(s.totalPaid, 1000);
  });

  test("cancelling an unconfirmed record keeps it in history but never counts it", async () => {
    const booking = await createWalkIn();
    const rec = await recordOffline(booking._id, { amount: 3000, method: "bank_transfer", reference: "UTR-CANCEL-01" });
    const pid = rec.body.data.payment._id;
    const cancel = await request(app).post(`/api/payments/offline/${pid}/cancel`).set(auth("manager")).send({ reason: "Transfer never arrived" });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.payment.status, "failed");
    assert.equal(cancel.body.data.payment.cancelledBy.name, "manager user");
    const confirmCancelled = await confirmOffline(pid);
    assert.equal(confirmCancelled.status, 400);

    const s = await summary(booking._id);
    assert.equal(s.totalPaid, 0);
    assert.equal(s.payments.length, 1);
    assert.equal(s.payments[0].status, "failed");

    // Its reference is free again (the earlier record was cancelled).
    const retry = await recordOffline(booking._id, { amount: 3000, method: "bank_transfer", reference: "UTR-CANCEL-01", confirmReceived: true });
    assert.equal(retry.status, 201);
    const cancelConfirmed = await request(app).post(`/api/payments/offline/${retry.body.data.payment._id}/cancel`).set(auth("manager")).send({});
    assert.equal(cancelConfirmed.status, 400, "confirmed payments can't be cancelled");
  });

  test("only authorized staff can record or confirm; customers never see staff details", async () => {
    const booking = await createWalkIn();
    const rec = await recordOffline(booking._id, { amount: 1000 });
    const pid = rec.body.data.payment._id;

    for (const who of ["customer", "coordinator", "limitedManager"]) {
      assert.equal((await recordOffline(booking._id, { amount: 100 }, who)).status, 403, `record as ${who}`);
      assert.equal((await confirmOffline(pid, who)).status, 403, `confirm as ${who}`);
      const cancel = await request(app).post(`/api/payments/offline/${pid}/cancel`).set(auth(who)).send({});
      assert.equal(cancel.status, 403, `cancel as ${who}`);
    }
    assert.equal((await request(app).post(`/api/payments/offline/${pid}/confirm`).send({})).status, 401);
    assert.equal((await Payment.findById(pid)).status, "pending");

    // Owner is never restricted by manager permissions.
    assert.equal((await confirmOffline(pid, "owner")).status, 200);

    // A customer can't read a walk-in booking's payments (not theirs).
    const res = await request(app).get(`/api/payments/booking/${booking._id}`).set(auth("customer"));
    assert.equal(res.status, 403);
  });

  test("a pending (unapproved) or rejected booking can't take offline payments", async () => {
    const created = await request(app)
      .post("/api/bookings")
      .set(auth("customer"))
      .send({ hall: hall._id.toString(), eventType: "Meeting", eventDate: nextDate(), startTime: "10:00", endTime: "12:00", guestCount: 10 });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.paymentStatus, "unpaid");
    assert.equal(created.body.data.source, "online");
    assert.equal((await recordOffline(created.body.data._id, { amount: 100 })).status, 400);

    await request(app).patch(`/api/bookings/${created.body.data._id}/status`).set(auth("manager")).send({ status: "rejected" });
    assert.equal((await recordOffline(created.body.data._id, { amount: 100 })).status, 400);
  });
});

describe("Razorpay compatibility", () => {
  const sign = (orderId, paymentId) =>
    crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

  // Stubs the Razorpay API calls the server makes.
  const stubRazorpay = () => {
    const rzp = getRazorpay();
    const orders = new Map();
    rzp.orders.create = async ({ amount, currency }) => {
      const id = `order_${crypto.randomBytes(7).toString("hex")}`;
      orders.set(id, { id, amount, currency, status: "created" });
      return orders.get(id);
    };
    rzp.orders.fetch = async (id) => orders.get(id);
    return orders;
  };

  const onlineApprovedBooking = async () => {
    const created = await request(app)
      .post("/api/bookings")
      .set(auth("customer"))
      .send({ hall: hall._id.toString(), eventType: "Wedding", eventDate: nextDate(), startTime: "10:00", endTime: "14:00", guestCount: 100, food: [food._id.toString()] });
    assert.equal(created.status, 201);
    const id = created.body.data._id;
    const approve = await request(app).patch(`/api/bookings/${id}/status`).set(auth("manager")).send({ status: "approved" });
    assert.equal(approve.status, 200);
    const b = await Booking.findById(id);
    assert.equal(b.paymentStatus, "unpaid", "approval never marks a booking paid");
    return id;
  };

  test("online-only flow still works and is not double counted on re-verification", async () => {
    stubRazorpay();
    const id = await onlineApprovedBooking();
    const order = await request(app).post(`/api/payments/${id}/order`).set(auth("customer"));
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.equal(order.body.data.advanceAmount, ADVANCE);

    // Razorpay payment id format: pay_<alnum>. Encode the order id/amount for the stub.
    const rzpPaymentId = `pay_${crypto.randomBytes(6).toString("hex")}`;
    getRazorpay().payments.fetch = async () => ({
      id: rzpPaymentId, order_id: order.body.data.orderId, amount: toPaise(ADVANCE), currency: "INR",
      status: "captured", method: "upi", created_at: Math.floor(Date.now() / 1000),
    });
    const body = { razorpay_order_id: order.body.data.orderId, razorpay_payment_id: rzpPaymentId, razorpay_signature: sign(order.body.data.orderId, rzpPaymentId) };

    const forged = await request(app).post(`/api/payments/${id}/verify`).set(auth("customer")).send({ ...body, razorpay_signature: "a".repeat(64) });
    assert.equal(forged.status, 400, "bad signature is refused");

    const v1 = await request(app).post(`/api/payments/${id}/verify`).set(auth("customer")).send(body);
    assert.equal(v1.status, 200, JSON.stringify(v1.body));
    const v2 = await request(app).post(`/api/payments/${id}/verify`).set(auth("customer")).send(body);
    assert.equal(v2.status, 200);
    assert.equal(v2.body.data.alreadyProcessed, true);

    const b = await Booking.findById(id);
    assert.equal(b.status, "confirmed");
    assert.equal(b.paymentStatus, "partially_paid");
    assert.equal(b.amountPaid, ADVANCE);

    const cust = await summary(id, "customer");
    assert.equal(cust.totalPaid, ADVANCE);
    assert.equal(cust.payments.length, 1);
    assert.equal(cust.payments[0].gateway, "razorpay");
    assert.equal(cust.payment.transactionId, rzpPaymentId);

    // A manager can't confirm a Razorpay record by hand…
    const rzpRecord = await Payment.findOne({ booking: id, gateway: "razorpay" });
    assert.equal((await confirmOffline(rzpRecord._id)).status, 400);
    // …not even an unverified (pending) one.
    const pendingOrder = await Payment.create({
      booking: id, customer: users.customer._id, amount: 10, gateway: "razorpay",
      transactionId: "order_pendingzzz1", razorpayOrderId: "order_pendingzzz1", status: "pending",
    });
    assert.equal((await confirmOffline(pendingOrder._id)).status, 400);
    assert.equal((await Payment.findById(pendingOrder._id)).status, "pending");

    // Balance paid offline afterwards: mixed online + offline, counted once each.
    const bal = await recordOffline(id, { amount: TOTAL - ADVANCE, method: "cash", confirmReceived: true });
    assert.equal(bal.status, 201);
    const s = await summary(id);
    assert.equal(s.totalPaid, TOTAL);
    assert.equal(s.remainingBalance, 0);
    assert.equal(s.paymentStatus, "paid");
    assert.equal((await Booking.findById(id)).paymentStatus, "paid");
  });

  test("offline part-advance first, then Razorpay charges only the rest of the advance", async () => {
    stubRazorpay();
    const id = await onlineApprovedBooking();
    const off = await recordOffline(id, { amount: 1500, confirmReceived: true });
    assert.equal(off.status, 201);
    assert.equal((await Booking.findById(id)).status, "approved");

    const order = await request(app).post(`/api/payments/${id}/order`).set(auth("customer"));
    assert.equal(order.status, 201, JSON.stringify(order.body));
    assert.equal(order.body.data.advanceAmount, ADVANCE - 1500);
    assert.equal(order.body.data.amount, toPaise(ADVANCE - 1500));

    const rzpPaymentId = `pay_${crypto.randomBytes(6).toString("hex")}`;
    getRazorpay().payments.fetch = async () => ({
      id: rzpPaymentId, order_id: order.body.data.orderId, amount: toPaise(ADVANCE - 1500), currency: "INR",
      status: "captured", method: "card", created_at: Math.floor(Date.now() / 1000),
    });
    const v = await request(app)
      .post(`/api/payments/${id}/verify`)
      .set(auth("customer"))
      .send({ razorpay_order_id: order.body.data.orderId, razorpay_payment_id: rzpPaymentId, razorpay_signature: sign(order.body.data.orderId, rzpPaymentId) });
    assert.equal(v.status, 200, JSON.stringify(v.body));
    assert.equal(v.body.data.totalPaid, ADVANCE);
    assert.equal(v.body.data.remainingBalance, TOTAL - ADVANCE);

    const b = await Booking.findById(id);
    assert.equal(b.status, "confirmed");
    assert.equal(b.amountPaid, ADVANCE);
    assert.equal(b.paymentStatus, "partially_paid");

    // Advance fully covered — no second online order.
    const again = await request(app).post(`/api/payments/${id}/order`).set(auth("customer"));
    assert.ok([400, 409].includes(again.status));
  });

  test("advance fully received offline: online payment is not offered again", async () => {
    stubRazorpay();
    const id = await onlineApprovedBooking();
    await recordOffline(id, { amount: ADVANCE, confirmReceived: true });
    const order = await request(app).post(`/api/payments/${id}/order`).set(auth("customer"));
    assert.equal(order.status, 400, "booking is confirmed now, so no longer awaiting payment");
    const cust = await summary(id, "customer");
    assert.equal(cust.totalPaid, ADVANCE);
    assert.equal(cust.payments[0].gateway, "offline");
    assert.equal(cust.payments[0].notes, undefined);
    assert.equal(cust.payments[0].recordedBy, undefined);
    assert.equal(cust.pendingOfflineAmount, undefined);
  });
});

describe("migration of existing data", () => {
  test("drops the old one-success index and fills in payment status without touching payments", async () => {
    await Payment.collection.createIndex(
      { booking: 1, createdAt: 1 },
      { unique: true, partialFilterExpression: { status: "success" }, name: "one_success_per_booking" }
    );
    const legacyId = new mongoose.Types.ObjectId();
    await Booking.collection.insertOne({
      _id: legacyId, customer: users.customer._id, hall: hall._id, eventType: "Old", eventDate: new Date("2025-01-01"),
      startTime: "10:00", endTime: "11:00", guestCount: 5, estimatedCost: 4000, status: "confirmed",
      food: [], decorations: [], services: [],
    });
    await Payment.collection.insertOne({
      booking: legacyId, customer: users.customer._id, amount: 2000, transactionId: "MOCK-legacy-1", status: "success", method: "card",
    });

    await runPaymentMigrations();

    const indexes = await Payment.collection.indexes();
    assert.ok(!indexes.some((i) => i.name === "one_success_per_booking"));
    assert.ok(indexes.some((i) => i.name === "one_razorpay_success_per_booking"));
    const b = await Booking.findById(legacyId);
    assert.equal(b.source, "online");
    assert.equal(b.amountPaid, 2000);
    assert.equal(b.paymentStatus, "partially_paid");
    assert.equal(await Payment.countDocuments({ booking: legacyId }), 1);

    const s = await summary(legacyId, "customer");
    assert.equal(s.totalPaid, 2000);
    assert.equal(s.payment.transactionId, "MOCK-legacy-1");
  });
});
