// Who a booking is for: the customer's account for online bookings, or the
// contact details staff entered for a walk-in customer (who may have no
// account).
export const bookingCustomer = (booking) => {
  if (booking?.customer) {
    return { name: booking.customer.name, email: booking.customer.email, phone: booking.customer.phone, walkIn: false };
  }
  const w = booking?.walkInCustomer;
  return { name: w?.name || "", email: w?.email || "", phone: w?.phone || "", walkIn: Boolean(w) };
};

export const isWalkIn = (booking) => booking?.source === "walk_in";

export const EVENT_TYPES = ["Wedding", "Birthday", "Engagement", "Corporate Event", "Conference", "Anniversary", "Other"];

export const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
