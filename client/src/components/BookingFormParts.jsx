// Building blocks shared by the customer booking form and the manager's
// walk-in booking form.
import { formatRs } from "../utils/format.js";

const groupByCategory = (items) =>
  (items || []).reduce((acc, item) => {
    const key = item.category || "Other";
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

// Shared checkbox-card block for Food/Decorations/Additional Services —
// same "pick any number of active items, show price" shape for all three,
// grouped by the item's category.
export const SelectableItemList = ({ items, selectedIds, onToggle }) => {
  if (!items || items.length === 0) return <p className="muted">None available right now.</p>;
  return Object.entries(groupByCategory(items)).map(([category, group]) => (
    <div key={category} className="option-group">
      <p className="course-label">{category}</p>
      <div className="option-grid">
        {group.map((item) => {
          const checked = selectedIds.includes(item._id);
          return (
            <label key={item._id} className={`option-card ${checked ? "selected" : ""}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(item._id)} />
              <span className="option-body">
                <span className="option-title">{item.name}</span>
                {item.description && <span className="option-desc clamp-2">{item.description}</span>}
              </span>
              <span className="price">{formatRs(item.price)}</span>
            </label>
          );
        })}
      </div>
    </div>
  ));
};

export const Section = ({ number, title, subtitle, children, id }) => (
  <section className="booking-section" id={id}>
    <div className="booking-section-head">
      <span className="step-number">{number}</span>
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);
