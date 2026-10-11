import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import Icon from "../../components/Icon.jsx";
import { apiError } from "../../utils/format.js";
import { INVALID_PHONE_MESSAGE, isValidIndianMobile, phoneInputValue } from "../../utils/phone.js";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === "phone" ? phoneInputValue(value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidIndianMobile(form.phone)) {
      setError(INVALID_PHONE_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password, form.phone);
      navigate(from ? `${from.pathname}${from.search || ""}` : "/", { replace: Boolean(from) });
    } catch (err) {
      setError(apiError(err, "Registration failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const passwordTooShort = form.password.length > 0 && form.password.length < 6;
  const phoneInvalid = form.phone.length > 0 && !isValidIndianMobile(form.phone);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <h1>Create your account</h1>
          <p className="muted">Book halls, track approvals and pay your advance online.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
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
              value={form.phone}
              onChange={handleChange}
              required
            />
            <p id="phone-help" className={`field-help ${phoneInvalid ? "danger-text" : ""}`}>
              {phoneInvalid ? INVALID_PHONE_MESSAGE : "10-digit mobile number, without +91. Used for booking contact and payments."}
            </p>
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={6}
              aria-describedby="password-help"
              value={form.password}
              onChange={handleChange}
              required
            />
            <p id="password-help" className={`field-help ${passwordTooShort ? "danger-text" : ""}`}>
              At least 6 characters.
            </p>
          </div>
          {error && (
            <p role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting && <span className="spinner spinner-light" aria-hidden="true" />}
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="auth-foot">
          Already have an account?{" "}
          <Link to="/login" state={from ? { from } : undefined}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
