import { useCallback, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { galleryApi } from "../../api/galleryApi.js";
import Lightbox from "../../components/Lightbox.jsx";
import Icon from "../../components/Icon.jsx";
import { EmptyState } from "../../components/States.jsx";
import { resolveImageUrl, formatDate } from "../../utils/format.js";
import { ROLES } from "../../constants/roles.js";

const GalleryDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const fetchEntry = useCallback(() => galleryApi.getPublishedById(id), [id]);
  const { data: entry, loading, error } = useFetch(fetchEntry);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const canBook = !user || user.role === ROLES.CUSTOMER;
  const planLink = entry
    ? `/booking?${new URLSearchParams({
        ...(entry.hall?._id && { hall: entry.hall._id }),
        eventType: entry.eventType,
      })}`
    : "/booking";

  return (
    <div>
      <Link to="/gallery" className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> Past events
      </Link>

      {loading && <div className="card skeleton skeleton-tall" />}
      {error && (
        <EmptyState
          icon="camera"
          title={error === "Not found" ? "This event is no longer available" : "We couldn't load this event"}
          message={error === "Not found" ? undefined : error}
        >
          <Link to="/gallery" className="button-link">
            See other events
          </Link>
        </EmptyState>
      )}

      {!loading && !error && entry && (
        <>
          <div className="page-head">
            <p className="eyebrow">{entry.eventType}</p>
            <h1>{entry.title}</h1>
            <div className="card-meta large">
              {entry.hall?.name && (
                <span>
                  <Icon name="pin" size={16} /> <Link to={`/halls/${entry.hall._id}`}>{entry.hall.name}</Link>
                </span>
              )}
              {entry.eventDate && (
                <span>
                  <Icon name="calendar" size={16} />{" "}
                  {formatDate(entry.eventDate, { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
              {entry.guestCount && (
                <span>
                  <Icon name="users" size={16} /> {entry.guestCount} guests
                </span>
              )}
              <span>
                <Icon name="camera" size={16} /> {entry.images.length} photos
              </span>
            </div>
            {entry.description && <p className="lead">{entry.description}</p>}
          </div>

          <div className="photo-grid">
            {entry.images.map((src, i) => (
              <button
                type="button"
                key={`${src}-${i}`}
                className={`photo-tile ${i === 0 ? "photo-tile-feature" : ""}`}
                onClick={() => setLightboxIndex(i)}
                aria-label={`Open photo ${i + 1} of ${entry.images.length}`}
              >
                <img src={resolveImageUrl(src)} alt={`${entry.title} — photo ${i + 1}`} loading="lazy" />
              </button>
            ))}
          </div>

          <Lightbox
            images={entry.images}
            index={lightboxIndex}
            onIndexChange={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
            caption={entry.title}
          />

          {canBook && (
            <section className="cta-band">
              <div>
                <h2>Planning something similar?</h2>
                <p>
                  Start a {entry.eventType.toLowerCase()} booking
                  {entry.hall?.name ? ` at ${entry.hall.name}` : ""} and get smart suggestions for your guests and budget.
                </p>
              </div>
              <Link to={planLink} className="button-link button-primary">
                Plan a similar event
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default GalleryDetailsPage;
