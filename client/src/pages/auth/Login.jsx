import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import Icon from "../../components/Icon.jsx";
import { apiError } from "../../utils/format.js";

const ROLE_HOME = {
  customer: "/",
  manager: "/manager",
  coordinator: "/coordinator",
  owner: "/owner",
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(form.email, form.password);
      // Customers sent here from a protected page (e.g. "Book this hall")
      // go straight back to it; everyone else lands on their role home.
      if (from && user.role === "customer") {
        navigate(`${from.pathname}${from.search || ""}`, { replace: true });
      } else {
        navigate(ROLE_HOME[user.role] || "/");
      }
    } catch (err) {
      setError(apiError(err, "Login failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <h1>Welcome back</h1>
          <p className="muted">Log in to book halls and manage your events.</p>
        </div>
        <form onSubmit={handleSubmit}>
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
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          {error && (
            <p role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <button type="submit" disabled={submitting}>
            {submitting && <span className="spinner spinner-light" aria-hidden="true" />}
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="auth-foot">
          New here?{" "}
          <Link to="/register" state={from ? { from } : undefined}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
