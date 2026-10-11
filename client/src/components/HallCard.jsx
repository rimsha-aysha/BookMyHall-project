import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { resolveImageUrl, formatRs } from "../utils/format.js";

// Venue card: cover photo (with photo count), name, capacity, starting
// price, short description, top amenities and a "View details" action.
// `footer` replaces the default action for page-specific buttons.
const HallCard = ({ hall, footer }) => {
  const cover = hall.images?.[0];
  return (
    <article className="card hall-card">
      <Link to={`/halls/${hall._id}`} className="card-media" aria-label={`View ${hall.name}`} tabIndex={-1}>
        {cover ? (
          <img src={resolveImageUrl(cover)} alt="" loading="lazy" />
        ) : (
          <span className="card-media-empty">
            <Icon name="image" size={28} />
          </span>
        )}
        {hall.images?.length > 1 && (
          <span className="media-count">
            <Icon name="camera" size={13} /> {hall.images.length}
          </span>
        )}
      </Link>
      <div className="card-body">
        <h3 className="card-title">
          <Link to={`/halls/${hall._id}`}>{hall.name}</Link>
        </h3>
        <p className="card-meta">
          <span>
            <Icon name="users" size={15} /> Up to {hall.capacity} guests
          </span>
        </p>
        {hall.description && <p className="card-text clamp-2">{hall.description}</p>}
        {hall.amenities?.length > 0 && (
          <div className="chips">
            {hall.amenities.slice(0, 3).map((a) => (
              <span key={a} className="chip">
                {a}
              </span>
            ))}
            {hall.amenities.length > 3 && <span className="chip chip-muted">+{hall.amenities.length - 3}</span>}
          </div>
        )}
      </div>
      <div className="card-footer">
        <span className="price-block">
          <span className="muted small">Starting from</span>
          <span className="price">{formatRs(hall.price)}</span>
        </span>
        {footer ?? (
          <Link to={`/halls/${hall._id}`} className="button-link button-sm">
            View details
          </Link>
        )}
      </div>
    </article>
  );
};

export default HallCard;
