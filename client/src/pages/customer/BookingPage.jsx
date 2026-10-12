import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { hallsApi, packagesApi, foodsApi, decorationsApi, servicesApi } from "../../api/catalogApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import SmartSuggestions from "../../components/SmartSuggestions.jsx";
import AvailabilityCalendar from "../../components/AvailabilityCalendar.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { SelectableItemList, Section } from "../../components/BookingFormParts.jsx";
import { EVENT_TYPES, toggleId } from "../../utils/booking.js";
import { LoadingState, ErrorState } from "../../components/States.jsx";
import { usePublicSettings } from "../../hooks/usePublicSettings.js";
import { resolveImageUrl, formatRs, formatDate, formatTimeRange, todayInputValue, apiError } from "../../utils/format.js";

const BookingPage = () => {
  const [searchParams] = useSearchParams();
  const { advancePaymentPercentage, policyNotes } = usePublicSettings();
  const { data: halls, loading: hallsLoading, error: hallsError } = useFetch(hallsApi.listActive);
  const { data: packages, loading: packagesLoading, error: packagesError } = useFetch(packagesApi.listActive);
  const { data: foods, loading: foodsLoading, error: foodsError } = useFetch(foodsApi.listActive);
  const { data: decorations, loading: decorationsLoading, error: decorationsError } = useFetch(
    decorationsApi.listActive
  );
  const { data: services, loading: servicesLoading, error: servicesError } = useFetch(servicesApi.listActive);

  // ?hall=<id>&eventType=<type>&date=YYYY-MM-DD pre-fill from the hall page
  // (incl. a date picked on its availability calendar) / gallery CTAs.
  const initialEventType = searchParams.get("eventType") || "";
  const initialDate = searchParams.get("date") || "";
  const [form, setForm] = useState(() => ({
    hall: searchParams.get("hall") || "",
    eventType: !initialEventType || EVENT_TYPES.includes(initialEventType) ? initialEventType : "Other",
    customEventType: initialEventType && !EVENT_TYPES.includes(initialEventType) ? initialEventType : "",
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && initialDate >= todayInputValue() ? initialDate : "",
    startTime: "",
    endTime: "",
    guestCount: "",
    requirements: "",
    package: "",
    food: [],
    decorations: [],
    services: [],
  }));
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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // A stale "Available"/"Not Available" result would be misleading once
    // the customer changes what they're checking — clear it.
    if (["hall", "eventDate", "startTime", "endTime", "guestCount"].includes(name)) {
      setAvailability(null);
    }
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "hall") setAvailability(null);
  };

  // Calendar date pick — same reset as editing the date field directly.
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

  // Check automatically (debounced) once hall + date + valid times are set.
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

  // Same formula the server uses in createBooking.
  const costLines = [
    { label: selectedHall ? `Hall · ${selectedHall.name}` : "Hall", amount: selectedHall?.price || 0 },
    { label: selectedPackage ? `Package · ${selectedPackage.name}` : "Package", amount: selectedPackage?.price || 0 },
    { label: `Food (${selectedFoods.length} item${selectedFoods.length === 1 ? "" : "s"})`, amount: sum(selectedFoods) },
    {
      label: `Decorations (${selectedDecorations.length})`,
      amount: sum(selectedDecorations),
    },
    { label: `Services (${selectedServices.length})`, amount: sum(selectedServices) },
  ];
  const estimatedCost = costLines.reduce((total, line) => total + line.amount, 0);

  const guestCountExceedsCapacity =
    selectedHall && form.guestCount && Number(form.guestCount) > selectedHall.capacity;

  const eventType = form.eventType === "Other" ? form.customEventType.trim() : form.eventType;

  const blockers = [];
  if (!eventType) blockers.push("choose an event type");
  if (!form.eventDate) blockers.push("pick an available date on the calendar");
  if (!timesValid) blockers.push("set a valid start and end time");
  if (!form.guestCount) blockers.push("enter the guest count");
  if (!form.hall) blockers.push("select a hall");
  if (guestCountExceedsCapacity) blockers.push("reduce guests or pick a larger hall");
  if (availability?.available === false) blockers.push("choose a free hall/time slot");

  const handleApplyPlan = (plan) => {
    setForm((prev) => ({
      ...prev,
      hall: plan.hall || prev.hall,
      package: plan.package || "",
      food: plan.food,
      decorations: plan.decorations,
      services: plan.services,
    }));
    setAvailability(null);
  };

  const handleSuggestionSelect = (kind, id) => {
    if (kind === "hall") setField("hall", form.hall === id ? "" : id);
    else if (kind === "package") setField("package", form.package === id ? "" : id);
    else setForm((prev) => ({ ...prev, [kind]: toggleId(prev[kind], id) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBooking(null);
    setSubmitting(true);
    try {
      const payload = {
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

      const res = await bookingApi.create(payload);
      setBooking(res.data.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(apiError(err, "Booking failed"));
      if (err.response?.status === 409) {
        runAvailabilityCheck();
        setCalendarRefresh((n) => n + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (booking) {
    return (
      <div className="success-panel card card-body">
        <div className="success-icon" aria-hidden="true">
          <Icon name="check" size={30} />
        </div>
        <h1>Booking request sent</h1>
        <p className="lead">
          Your request for <strong>{selectedHall?.name}</strong> on {formatDate(booking.eventDate)} (
          {formatTimeRange(booking.startTime, booking.endTime)}) is now with our manager for approval.
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
            <dt>Estimated cost</dt>
            <dd className="price">{formatRs(booking.estimatedCost)}</dd>
          </div>
        </dl>
        <ol className="next-steps">
          <li>The manager reviews your request.</li>
          <li>Once approved, you pay the advance online to confirm the date.</li>
          <li>A coordinator prepares your event; you can track progress any time.</li>
        </ol>
        <div className="card-actions center">
          <Link to={`/my-bookings/${booking._id}`} className="button-link button-primary">
            Track this booking
          </Link>
          <Link to="/my-bookings" className="button-link">
            All my bookings
          </Link>
          <button type="button" onClick={() => setBooking(null)}>
            Make another booking
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Book an event"
        title="Plan your event"
        lead="Tell us about your event, choose a hall and an open date, customise everything and watch your estimate update. Your request goes to our manager for approval before any payment."
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
            <Section number="1" title="Event details" subtitle="What, when and how many guests.">
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
                <label htmlFor="requirements">Special requirements</label>
                <textarea
                  id="requirements"
                  name="requirements"
                  placeholder="e.g. stage for speeches, kids' corner, live music, wheelchair access…"
                  value={form.requirements}
                  onChange={handleChange}
                />
                <p className="muted small">Shared with the manager and your event coordinator.</p>
              </div>
            </Section>

            <Section number="2" title="Get smart suggestions" subtitle="Optional — let us recommend a plan that fits.">
              <SmartSuggestions
                eventDetails={{
                  eventType,
                  guestCount: form.guestCount,
                  eventDate: form.eventDate,
                  startTime: form.startTime,
                  endTime: form.endTime,
                }}
                requirements={form.requirements}
                selection={form}
                onApplyPlan={handleApplyPlan}
                onSelect={handleSuggestionSelect}
              />
            </Section>

            <Section number="3" title="Choose a hall" subtitle="Halls too small for your guest count are greyed out.">
              <div className="option-grid hall-options" role="radiogroup" aria-label="Hall">
                {halls.map((hall) => {
                  const tooSmall = Number(form.guestCount) > hall.capacity;
                  const checked = form.hall === hall._id;
                  return (
                    <label
                      key={hall._id}
                      className={`option-card hall-option ${checked ? "selected" : ""} ${tooSmall ? "disabled" : ""}`}
                    >
                      <input
                        type="radio"
                        name="hall"
                        value={hall._id}
                        checked={checked}
                        onChange={handleChange}
                        required
                      />
                      <span className="hall-option-thumb">
                        {hall.images?.[0] && <img src={resolveImageUrl(hall.images[0])} alt="" loading="lazy" />}
                      </span>
                      <span className="option-body">
                        <span className="option-title">{hall.name}</span>
                        <span className="option-desc">
                          <Icon name="users" size={14} /> Up to {hall.capacity} guests
                          {tooSmall && <strong className="danger-text"> · too small</strong>}
                        </span>
                        <Link to={`/halls/${hall._id}`} target="_blank" rel="noreferrer" className="small">
                          Photos & details
                        </Link>
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
              title="Pick a date & time"
              subtitle={
                selectedHall
                  ? `Live availability for ${selectedHall.name}. Pick an open date, then your event times.`
                  : "Select a hall above to see its availability calendar."
              }
              id="date-time"
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
              {form.startTime && form.endTime && !timesValid && (
                <p role="alert">End time must be after start time.</p>
              )}
            </Section>

            <Section number="5" title="Package" subtitle="Optional bundle of hall time, décor and services.">
              <div className="option-grid">
                <label className={`option-card ${!form.package ? "selected" : ""}`}>
                  <input type="radio" name="package" value="" checked={!form.package} onChange={handleChange} />
                  <span className="option-body">
                    <span className="option-title">No package</span>
                    <span className="option-desc">Customise everything à la carte.</span>
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

            <Section number="6" title="Food" subtitle="Optional — pick any dishes for your menu.">
              <SelectableItemList
                items={foods}
                selectedIds={form.food}
                onToggle={(id) => setForm((prev) => ({ ...prev, food: toggleId(prev.food, id) }))}
              />
            </Section>

            <Section number="7" title="Decorations" subtitle="Optional — themes, florals and stage setups.">
              <SelectableItemList
                items={decorations}
                selectedIds={form.decorations}
                onToggle={(id) => setForm((prev) => ({ ...prev, decorations: toggleId(prev.decorations, id) }))}
              />
            </Section>

            <Section number="8" title="Additional services" subtitle="Optional — photography, music and more.">
              <SelectableItemList
                items={services}
                selectedIds={form.services}
                onToggle={(id) => setForm((prev) => ({ ...prev, services: toggleId(prev.services, id) }))}
              />
            </Section>
          </div>

          <aside className="booking-summary">
            <div className="card card-body">
              <h2>Your booking</h2>
              <div className="summary-meta">
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
                {availability && (
                  <>
                    {availability.available ? (
                      <p className="success-text">
                        <span className="badge badge-success">Available</span> {availability.message}
                      </p>
                    ) : (
                      <p role="alert">
                        <Icon name="x" size={16} /> Not available — {availability.message}
                      </p>
                    )}
                    {availability.bookedSlots?.length > 0 && (
                      <p className="muted small">
                        Already booked that day:{" "}
                        {availability.bookedSlots.map((s) => formatTimeRange(s.startTime, s.endTime)).join(", ")}
                      </p>
                    )}
                    {availability.alternatives?.length > 0 && (
                      <div className="alternatives">
                        <p className="small">Free at that time:</p>
                        {availability.alternatives.map((alt) => (
                          <button type="button" key={alt._id} onClick={() => setField("hall", alt._id)}>
                            <Icon name="building" size={15} /> {alt.name} · {alt.capacity} guests · {formatRs(alt.price)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {error && <p role="alert">{error}</p>}

              <button type="submit" className="block" disabled={submitting || blockers.length > 0}>
                {submitting ? "Sending request…" : "Send booking request"}
              </button>
              {blockers.length > 0 ? (
                <p className="muted small">To continue: {blockers.join(", ")}.</p>
              ) : (
                <p className="muted small">
                  Sent to the manager for approval. After approval you pay a {advancePaymentPercentage}% advance (about{" "}
                  {formatRs(Math.round((estimatedCost * advancePaymentPercentage) / 100))}) to confirm.
                </p>
              )}
              {policyNotes && (
                <details className="small">
                  <summary>Booking policies</summary>
                  <p className="muted mt-8 pre-line">{policyNotes}</p>
                </details>
              )}
            </div>
          </aside>
        </form>
      )}
    </div>
  );
};

export default BookingPage;
