import Icon from "./Icon.jsx";

// Shared loading / empty / error states so no page is ever left blank.

// Skeleton placeholders sized like the content they stand in for, so the
// page doesn't jump when data arrives.
export const LoadingState = ({ variant = "cards", count = 3, label = "Loading…" }) => (
  <div className={`skeleton-set skeleton-${variant}`} role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton-item" aria-hidden="true">
        {variant === "cards" && <div className="skeleton skeleton-media" />}
        <div className="skeleton-lines">
          <div className="skeleton skeleton-line w-60" />
          <div className="skeleton skeleton-line w-90" />
          <div className="skeleton skeleton-line w-40" />
        </div>
      </div>
    ))}
  </div>
);

export const EmptyState = ({ title, message, icon = "inbox", children }) => (
  <div className="state-box empty-state">
    <span className="state-icon">
      <Icon name={icon} size={22} />
    </span>
    {title && <h3>{title}</h3>}
    {message && <p className="muted">{message}</p>}
    {children && <div className="card-actions center">{children}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry, children }) => (
  <div className="state-box error-state" role="alert">
    <span className="state-icon">
      <Icon name="alert" size={22} />
    </span>
    <h3>We couldn't load this</h3>
    <p className="muted">{message || "Something went wrong. Please try again."}</p>
    {(onRetry || children) && (
      <div className="card-actions center">
        {onRetry && (
          <button type="button" onClick={onRetry}>
            <Icon name="refresh" size={16} /> Try again
          </button>
        )}
        {children}
      </div>
    )}
  </div>
);
