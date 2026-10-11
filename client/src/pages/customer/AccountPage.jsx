import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { apiError } from "../../utils/format.js";
import { INVALID_PHONE_MESSAGE, formatPhone, isValidIndianMobile, phoneInputValue } from "../../utils/phone.js";

// Customer's own profile. Only the phone number is editable here.
// Pages that need a phone (e.g. payment) link here with state.from so the
// customer is sent straight back after saving.
const AccountPage = () => {
  const { user, updatePhone } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = location.state?.from;

  const [editing, setEditing] = useState(!user.phone);
  const [phone, setPhone] = useState(user.phone || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const phoneInvalid = phone.length > 0 && !isValidIndianMobile(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    if (!isValidIndianMobile(phone)) {
      setError(INVALID_PHONE_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await updatePhone(phone);
      setEditing(false);
      setSaved(true);
      if (returnTo) navigate(returnTo, { replace: true });
    } catch (err) {
      setError(apiError(err, "Could not save your phone number"));
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setPhone(user.phone || "");
    setError("");
    setEditing(false);
  };

  return (
    <div>
      <PageHeader eyebrow="Your account" title="My profile" lead="Your contact details for bookings and payments." />

      <section className="card card-body" style={{ maxWidth: 560 }}>
        <h2>Contact details</h2>

        {!user.phone && (
          <div className="notice notice-warning" role="status">
            <strong>Please add your phone number</strong>
            <span className="small">
              It's needed to pay your booking advance online and lets the restaurant contact you about your event.
            </span>
          </div>
        )}
        {saved && <p className="alert-success">Phone number saved.</p>}

        <dl className="facts">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          {!editing && (
            <div>
              <dt>Phone Number</dt>
              <dd>{user.phone ? formatPhone(user.phone) : <span className="muted">Not added</span>}</dd>
            </div>
          )}
        </dl>

        {editing ? (
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9876543210"
                maxLength={10}
                aria-describedby="phone-help"
                aria-invalid={phoneInvalid}
                value={phone}
                onChange={(e) => setPhone(phoneInputValue(e.target.value))}
                required
              />
              <p id="phone-help" className={`field-help ${phoneInvalid ? "danger-text" : ""}`}>
                {phoneInvalid ? INVALID_PHONE_MESSAGE : "10-digit mobile number, without +91."}
              </p>
            </div>
            {error && (
              <p role="alert">
                <Icon name="alert" size={16} /> {error}
              </p>
            )}
            <div className="button-row">
              <button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? "Saving…" : user.phone ? "Update phone number" : "Save phone number"}
              </button>
              {user.phone && (
                <button type="button" onClick={cancelEdit} disabled={submitting}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => { setSaved(false); setEditing(true); }}>
            Edit phone number
          </button>
        )}

        {returnTo && !editing && (
          <p className="mt-8">
            <Link to={returnTo}>Continue to payment</Link>
          </p>
        )}
      </section>
    </div>
  );
};

export default AccountPage;
