import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { resolveImageUrl, formatDate } from "../utils/format.js";

// Summary card for a previous event in the gallery.
const GalleryCard = ({ entry }) => (
  <article className="card gallery-card">
    <Link to={`/gallery/${entry._id}`} className="card-media" aria-label={`View photos of ${entry.title}`}>
      <img src={resolveImageUrl(entry.images?.[0])} alt="" loading="lazy" />
      <span className="media-count">
        <Icon name="camera" size={13} /> {entry.images?.length || 0}
      </span>
      <span className="badge media-badge">{entry.eventType}</span>
    </Link>
    <div className="card-body">
      <h3 className="card-title">
        <Link to={`/gallery/${entry._id}`}>{entry.title}</Link>
      </h3>
      <div className="card-meta">
        {entry.hall?.name && (
          <span>
            <Icon name="pin" size={14} /> {entry.hall.name}
          </span>
        )}
        {entry.eventDate && (
          <span>
            <Icon name="calendar" size={14} /> {formatDate(entry.eventDate)}
          </span>
        )}
        {entry.guestCount && (
          <span>
            <Icon name="users" size={14} /> {entry.guestCount} guests
          </span>
        )}
      </div>
    </div>
  </article>
);

export default GalleryCard;
