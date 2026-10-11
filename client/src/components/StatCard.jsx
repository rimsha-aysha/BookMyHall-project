import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

// Dashboard summary figure. Only ever fed real values from the API.
const StatCard = ({ label, value, hint, icon, to, tone }) => {
  const body = (
    <>
      <span className="stat-label">
        {icon && <Icon name={icon} size={16} />} {label}
      </span>
      <span className={`stat-value ${tone ? `text-${tone}` : ""}`}>{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  return to ? (
    <Link to={to} className="stat-card is-link">
      {body}
    </Link>
  ) : (
    <div className="stat-card">{body}</div>
  );
};

export const StatGrid = ({ children, loading, count = 4 }) => (
  <div className="stat-grid">
    {loading
      ? Array.from({ length: count }, (_, i) => (
          <div key={i} className="stat-card" aria-hidden="true">
            <span className="skeleton skeleton-line w-60" />
            <span className="skeleton skeleton-line w-40 tall" />
          </div>
        ))
      : children}
  </div>
);

// Large tappable shortcut used for dashboard quick actions.
export const ActionCard = ({ to, icon, title, text }) => (
  <Link to={to} className="action-card">
    <span className="action-icon">
      <Icon name={icon} size={20} />
    </span>
    <span className="action-text">
      <strong>{title}</strong>
      {text && <span className="muted small">{text}</span>}
    </span>
    <Icon name="chevronRight" size={18} className="action-arrow" />
  </Link>
);

export default StatCard;
