import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { hallsApi, packagesApi, foodsApi, decorationsApi, servicesApi } from "../../api/catalogApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import AvailabilityCalendar from "../../components/AvailabilityCalendar.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { SelectableItemList, Section } from "../../components/BookingFormParts.jsx";
import { EVENT_TYPES, toggleId } from "../../utils/booking.js";
import { WalkInBadge } from "../../components/BookingStatus.jsx";
import { LoadingState, ErrorState } from "../../components/States.jsx";
import { usePublicSettings } from "../../hooks/usePublicSettings.js";
import { formatRs, formatDate, formatTimeRange, apiError } from "../../utils/format.js";
import { isValidIndianMobile, INVALID_PHONE_MESSAGE, phoneInputValue } from "../../utils/phone.js";

const EMPTY_FORM = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  hall: "",
  eventType: "",
  customEventType: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  guestCount: "",
  requirements: "",
  package: "",
  food: [],
  decorations: [],
  services: [],
};

// Manager/Owner: book a hall for a customer who came to the venue in person
// (they don't need an online account). The server prices it, re-checks
// availability and saves it as an approved walk-in booking; payments are then
// recorded from the booking's page.
const WalkInBooking = () => {
  const { advancePaymentPercentage } = usePublicSettings();
  const { data: halls, loading: hallsLoading, error: hallsError } = useFetch(hallsApi.listActive);
  const { data: packages, loading: packagesLoading, error: packagesError } = useFetch(packagesApi.listActive);
  const { data: foods, loading: foodsLoading, error: foodsError } = useFetch(foodsApi.listActive);
  const { data: decorations, loading: decorationsLoading, error: decorationsError } = useFetch(
    decorationsApi.listActive
  );
  const { data: services, loading: servicesLoading, error: servicesError } = useFetch(servicesApi.listActive);

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const availabilityRequest = useRef(0);
  const [calendarRefresh, setCalendarRefresh] = useState(0);

  const catalogsLoading = hallsLoading || packagesLoading || foodsLoading || decorationsLoading || servicesLoading;
  const catalogsError = hallsError || packagesError || foodsError || decorationsError || servicesError;

  const handleChange = (e) => {
    const { name } = e.target;
    const value = name === "customerPhone" ? phoneInputValue(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (["hall", "eventDate", "startTime", "endTime", "guestCount"].includes(name)) setAvailability(null);
  };

  const selectDate = useCallback((eventDate) => {
    setForm((prev) => ({ ...prev, eventDate }));
    setAvailability(null);
  }, []);

  const timesValid = form.startTime && form.endTime && form.endTime > form.startTime;
  const canCheckAvailability = form.hall && form.eventDate && timesValid;

  const runAvailabilityCheck = async () => {
    const requestId = ++availabilityRequest.current;
    setAvailabilityError("");
    setCheckingAvailability(true);
    try {
      const res = await bookingApi.checkAvailability({
        hall: form.hall,
        eventDate: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,
        ...(Number(form.guestCount) > 0 && { guestCount: Number(form.guestCount) }),
      });
      if (requestId === availabilityRequest.current) setAvailability(res.data.data);
    } catch (err) {
      if (requestId === availabilityRequest.current) {
        setAvailability(null);
        setAvailabilityError(apiError(err, "Could not check availability"));
      }
    } finally {
      if (requestId === availabilityRequest.current) setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (!canCheckAvailability) return undefined;
    const timer = setTimeout(runAvailabilityCheck, 450);
    return () => clearTimeout(timer);
    // runAvailabilityCheck reads the latest form via closure on each run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.hall, form.eventDate, form.startTime, form.endTime, form.guestCount, canCheckAvailability]);

  const selectedHall = halls?.find((h) => h._id === form.hall);
  const selectedPackage = packages?.find((p) => p._id === form.package);
  const selectedFoods = (foods || []).filter((f) => form.food.includes(f._id));
  const selectedDecorations = (decorations || []).filter((d) => form.decorations.includes(d._id));
  const selectedServices = (services || []).filter((s) => form.services.includes(s._id));
  const sum = (items) => items.reduce((total, item) => total + item.price, 0);

  // Preview only — the server prices the booking itself (same formula).
  const costLines = [
    { label: selectedHall ? `Hall · ${selectedHall.name}` : "Hall", amount: selectedHall?.price || 0 },
    { label: selectedPackage ? `Package · ${selectedPackage.name}` : "Package", amount: selectedPackage?.price || 0 },
    { label: `Food (${selectedFoods.length})`, amount: sum(selectedFoods) },
    { label: `Decorations (${selectedDecorations.length})`, amount: sum(selectedDecorations) },
    { label: `Services (${selectedServices.length})`, amount: sum(selectedServices) },
  ];
  const estimatedCost = costLines.reduce((total, line) => total + line.amount, 0);

  const guestCountExceedsCapacity = selectedHall && form.guestCount && Number(form.guestCount) > selectedHall.capacity;
  const eventType = form.eventType === "Other" ? form.customEventType.trim() : form.eventType;
  const phoneInvalid = form.customerPhone.trim() !== "" && !isValidIndianMobile(form.customerPhone);

  const blockers = [];
  if (!form.customerName.trim()) blockers.push("enter the customer's name");
  if (!form.customerPhone.trim() || phoneInvalid) blockers.push("enter a valid phone number");
  if (!eventType) blockers.push("choose an event type");
  if (!form.hall) blockers.push("select a hall");
  if (!form.eventDate) blockers.push("pick a date");
  if (!timesValid) blockers.push("set a valid start and end time");
  if (!form.guestCount) blockers.push("enter the guest count");
  if (guestCountExceedsCapacity) blockers.push("reduce guests or pick a larger hall");
  if (availability?.available === false) blockers.push("choose a free hall/time slot");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        hall: form.hall,
        eventType,
        eventDate: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,
        guestCount: Number(form.guestCount),
        requirements: form.requirements,
        food: form.food,
        decorations: form.decorations,
        services: form.services,
      };
      if (form.package) payload.package = form.package;
      const res = await bookingApi.createWalkIn(payload);
      setBooking(res.data.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(apiError(err, "Could not create the booking"));
      if (err.response?.status === 409) {
        runAvailabilityCheck();
        setCalendarRefresh((n) => n + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setBooking(null);
    setForm(EMPTY_FORM);
    setAvailability(null);
    setError("");
  };

  if (booking) {
    const advance = Math.round((booking.estimatedCost * advancePaymentPercentage) / 100);
    return (
      <div className="success-panel card card-body">
        <div className="success-icon" aria-hidden="true">
          <Icon name="check" size={30} />
        </div>
        <h1>Walk-in booking saved</h1>
        <p className="lead">
          <strong>{booking.hall?.name}</strong> is booked for {booking.walkInCustomer?.name} on{" "}
          {formatDate(booking.eventDate)} ({formatTimeRange(booking.startTime, booking.endTime)}).
        </p>
        <p>
          <WalkInBadge source={booking.source} /> <span className="badge badge-neutral">Unpaid</span>
        </p>
        <dl className="facts">
          <div>
            <dt>Event</dt>
            <dd>{booking.eventType}</dd>
          </div>
          <div>
            <dt>Guests</dt>
            <dd>{booking.guestCount}</dd>
          </div>
          <div>
            <dt>Total cost</dt>
            <dd className="price">{formatRs(booking.estimatedCost)}</dd>
          </div>
          <div>
            <dt>Advance ({advancePaymentPercentage}%)</dt>
            <dd className="price">{formatRs(advance)}</dd>
          </div>
        </dl>
        <ol className="next-steps">
          <li>Record the advance once it's received — the booking is confirmed when the advance is confirmed.</li>
          <li>Assign a coordinator to prepare the event.</li>
          <li>Record the balance payment(s) as they come in.</li>
        </ol>
        <div className="card-actions center">
          <Link to={`/manage/bookings/${booking._id}`} className="button-link button-primary">
            <Icon name="card" size={16} /> Open booking & record payment
          </Link>
          <button type="button" onClick={startAnother}>
            New walk-in booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/manage/bookings" className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> All bookings
      </Link>
      <PageHeader
        eyebrow="Operations"
        title="Walk-in booking"
        lead="Book a hall for a customer at the venue. No online account is needed; the booking is priced and checked for availability exactly like an online request."
      />

      {catalogsLoading && (
        <div className="booking-layout">
          <LoadingState variant="list" count={3} />
          <div className="card skeleton" />
        </div>
      )}
      {catalogsError && <ErrorState message={catalogsError} onRetry={() => window.location.reload()} />}

      {!catalogsLoading && !catalogsError && (
        <form onSubmit={handleSubmit} className="booking-layout">
          <div className="booking-main">
            <Section number="1" title="Customer" subtitle="Contact details for the customer at the counter.">
              <div className="form-row">
                <div>
                  <label htmlFor="customerName">Name</label>
                  <input
                    id="customerName"
                    name="customerName"
                    type="text"
                    maxLength={100}
                    autoComplete="off"
                    value={form.customerName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="customerPhone">Phone number</label>
                  <input
                    id="customerPhone"
                    name="customerPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={form.customerPhone}
                    onChange={handleChange}
                    aria-invalid={phoneInvalid || undefined}
                    required
                  />
                  {phoneInvalid && <p className="field-help danger-text">{INVALID_PHONE_MESSAGE}</p>}
                </div>
                <div>
                  <label htmlFor="customerEmail">Email (optional)</label>
                  <input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    autoComplete="off"
                    value={form.customerEmail}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </Section>

            <Section number="2" title="Event details" subtitle="What, when and how many guests.">
              <div className="form-row">
                <div>
                  <label htmlFor="eventType">Event Type</label>
                  <select id="eventType" name="eventType" value={form.eventType} onChange={handleChange} required>
                    <option value="">Select event type</option>
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {form.eventType === "Other" && (
                    <input
                      type="text"
                      name="customEventType"
                      placeholder="Describe the event type"
                      value={form.customEventType}
                      onChange={handleChange}
                      required
                      className="mt-8"
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="guestCount">Guest Count</label>
                  <input
                    id="guestCount"
                    name="guestCount"
                    type="number"
                    min="1"
                    value={form.guestCount}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="requirements">Additional requirements</label>
                <textarea
                  id="requirements"
                  name="requirements"
                  placeholder="e.g. stage for speeches, kids' corner, live music, wheelchair access…"
                  value={form.requirements}
                  onChange={handleChange}
                />
              </div>
            </Section>

            <Section number="3" title="Hall" subtitle="Halls too small for the guest count are marked.">
              <div className="option-grid hall-options" role="radiogroup" aria-label="Hall">
                {halls.map((hall) => {
                  const tooSmall = Number(form.guestCount) > hall.capacity;
                  const checked = form.hall === hall._id;
                  return (
                    <label
                      key={hall._id}
                      className={`option-card ${checked ? "selected" : ""} ${tooSmall ? "disabled" : ""}`}
                    >
                      <input type="radio" name="hall" value={hall._id} checked={checked} onChange={handleChange} required />
                      <span className="option-body">
                        <span className="option-title">{hall.name}</span>
                        <span className="option-desc">
                          <Icon name="users" size={14} /> Up to {hall.capacity} guests
                          {tooSmall && <strong className="danger-text"> · too small</strong>}
                        </span>
                      </span>
                      <span className="price">{formatRs(hall.price)}</span>
                    </label>
                  );
                })}
              </div>
              {guestCountExceedsCapacity && (
                <p role="alert">This exceeds the selected hall's capacity ({selectedHall.capacity}).</p>
              )}
            </Section>

            <Section
              number="4"
              title="Date & time"
              subtitle={selectedHall ? `Live availability for ${selectedHall.name}.` : "Select a hall to see its calendar."}
            >
              {form.hall && (
                <AvailabilityCalendar
                  hallId={form.hall}
                  value={form.eventDate}
                  onChange={selectDate}
                  refreshKey={calendarRefresh}
                />
              )}
              <div className="form-row">
                <div>
                  <label htmlFor="startTime">Start Time</label>
                  <input id="startTime" name="startTime" type="time" value={form.startTime} onChange={handleChange} required />
                </div>
                <div>
                  <label htmlFor="endTime">End Time</label>
                  <input id="endTime" name="endTime" type="time" value={form.endTime} onChange={handleChange} required />
                </div>
              </div>
              {form.startTime && form.endTime && !timesValid && <p role="alert">End time must be after start time.</p>}
            </Section>

            <Section number="5" title="Package" subtitle="Optional bundle.">
              <div className="option-grid">
                <label className={`option-card ${!form.package ? "selected" : ""}`}>
                  <input type="radio" name="package" value="" checked={!form.package} onChange={handleChange} />
                  <span className="option-body">
                    <span className="option-title">No package</span>
                  </span>
                </label>
                {packages.map((pkg) => (
                  <label key={pkg._id} className={`option-card ${form.package === pkg._id ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="package"
                      value={pkg._id}
                      checked={form.package === pkg._id}
                      onChange={handleChange}
                    />
                    <span className="option-body">
                      <span className="option-title">{pkg.name}</span>
                      {pkg.includedItems?.length > 0 && (
                        <span className="option-desc clamp-2">Includes: {pkg.includedItems.join(", ")}</span>
                      )}
                    </span>
                    <span className="price">{formatRs(pkg.price)}</span>
                  </label>
                ))}
              </div>
            </Section>

            <Section number="6" title="Food" subtitle="Optional.">
              <SelectableItemList
                items={foods}
                selectedIds={form.food}
                onToggle={(id) => setForm((prev) => ({ ...prev, food: toggleId(prev.food, id) }))}
              />
            </Section>

            <Section number="7" title="Decorations" subtitle="Optional.">
              <SelectableItemList
                items={decorations}
                selectedIds={form.decorations}
                onToggle={(id) => setForm((prev) => ({ ...prev, decorations: toggleId(prev.decorations, id) }))}
              />
            </Section>

            <Section number="8" title="Additional services" subtitle="Optional.">
              <SelectableItemList
                items={services}
                selectedIds={form.services}
                onToggle={(id) => setForm((prev) => ({ ...prev, services: toggleId(prev.services, id) }))}
              />
            </Section>
          </div>

          <aside className="booking-summary">
            <div className="card card-body">
              <h2>Walk-in booking</h2>
              <div className="summary-meta">
                <span className={form.customerName.trim() ? "" : "is-empty"}>
                  <Icon name="user" size={15} /> {form.customerName.trim() || "Customer name not entered"}
                </span>
                <span className={eventType ? "" : "is-empty"}>
                  <Icon name="sparkles" size={15} /> {eventType || "Event type not chosen"}
                </span>
                <span className={selectedHall ? "" : "is-empty"}>
                  <Icon name="building" size={15} /> {selectedHall?.name || "No hall selected"}
                </span>
                <span className={form.eventDate ? "" : "is-empty"}>
                  <Icon name="calendar" size={15} />{" "}
                  {form.eventDate
                    ? formatDate(form.eventDate, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                    : "No date selected"}
                </span>
                <span className={timesValid ? "" : "is-empty"}>
                  <Icon name="clock" size={15} /> {timesValid ? formatTimeRange(form.startTime, form.endTime) : "No time set"}
                </span>
                <span className={form.guestCount ? "" : "is-empty"}>
                  <Icon name="users" size={15} /> {form.guestCount ? `${form.guestCount} guests` : "Guest count not set"}
                </span>
              </div>

              <dl className="cost-lines">
                {costLines.map((line) => (
                  <div key={line.label} className={line.amount ? "" : "muted"}>
                    <dt>{line.label}</dt>
                    <dd>{formatRs(line.amount)}</dd>
                  </div>
                ))}
                <div className="cost-total">
                  <dt>Estimated total</dt>
                  <dd>{formatRs(estimatedCost)}</dd>
                </div>
              </dl>

              <div className="availability-box">
                <div className="availability-head">
                  <strong>Availability</strong>
                  <button
                    type="button"
                    className="link-button"
                    onClick={runAvailabilityCheck}
                    disabled={!canCheckAvailability || checkingAvailability}
                  >
                    {checkingAvailability ? "Checking..." : "Check Availability"}
                  </button>
                </div>
                {!canCheckAvailability && (
                  <p className="muted small">Select a hall, date and time to check automatically.</p>
                )}
                {availabilityError && <p role="alert">{availabilityError}</p>}
                {availability &&
                  (availability.available ? (
                    <p className="success-text">
                      <span className="badge badge-success">Available</span> {availability.message}
                    </p>
                  ) : (
                    <p role="alert">
                      <Icon name="x" size={16} /> Not available — {availability.message}
                    </p>
                  ))}
                {availability?.bookedSlots?.length > 0 && (
                  <p className="muted small">
                    Already booked that day:{" "}
                    {availability.bookedSlots.map((s) => formatTimeRange(s.startTime, s.endTime)).join(", ")}
                  </p>
                )}
              </div>

              {error && <p role="alert">{error}</p>}

              <button type="submit" className="block" disabled={submitting || blockers.length > 0}>
                {submitting ? "Saving booking…" : "Create walk-in booking"}
              </button>
              {blockers.length > 0 ? (
                <p className="muted small">To continue: {blockers.join(", ")}.</p>
              ) : (
                <p className="muted small">
                  Saved as approved and unpaid. A {advancePaymentPercentage}% advance (about{" "}
                  {formatRs(Math.round((estimatedCost * advancePaymentPercentage) / 100))}) confirms it — record it
                  from the booking page once received.
                </p>
              )}
            </div>
          </aside>
        </form>
      )}
    </div>
  );
};

export default WalkInBooking;
