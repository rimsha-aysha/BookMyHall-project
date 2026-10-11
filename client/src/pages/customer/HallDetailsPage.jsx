import { useCallback, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { hallsApi } from "../../api/catalogApi.js";
import { galleryApi } from "../../api/galleryApi.js";
import { reviewApi } from "../../api/reviewApi.js";
import ImageCarousel from "../../components/ImageCarousel.jsx";
import GalleryCard from "../../components/GalleryCard.jsx";
import AvailabilityCalendar from "../../components/AvailabilityCalendar.jsx";
import Icon from "../../components/Icon.jsx";
import { EmptyState, ErrorState } from "../../components/States.jsx";
import { formatRs, formatDate } from "../../utils/format.js";
import { ROLES } from "../../constants/roles.js";

const Stars = ({ value }) => (
  <span className="stars" aria-label={`${value} out of 5`}>
    {"★★★★★".slice(0, Math.round(value))}
    <span className="stars-empty">{"★★★★★".slice(Math.round(value))}</span>
  </span>
);

const HallDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const fetchHall = useCallback(() => hallsApi.getActiveById(id), [id]);
  const { data: hall, loading, error, reload } = useFetch(fetchHall);
  const fetchEvents = useCallback(() => galleryApi.listPublished({ hall: id, limit: 6 }), [id]);
  const { data: pastEvents } = useFetch(fetchEvents);
  const fetchReviews = useCallback(() => reviewApi.getForHall(id), [id]);
  const { data: reviewSummary } = useFetch(fetchReviews);
  const [selectedDate, setSelectedDate] = useState("");

  const isCustomer = user?.role === ROLES.CUSTOMER;
  const canBook = !user || isCustomer;
  const bookLink = `/booking?hall=${id}${selectedDate ? `&date=${selectedDate}` : ""}`;

  return (
    <div>
      <Link to="/halls" className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> All halls
      </Link>

      {loading && (
        <div className="detail-layout">
          <div className="card skeleton skeleton-tall" />
          <div className="card skeleton" />
        </div>
      )}
      {error &&
        (error === "Not found" ? (
          <EmptyState icon="building" title="This hall is not available" message="It may have been removed or deactivated.">
            <Link to="/halls" className="button-link">
              Browse other halls
            </Link>
          </EmptyState>
        ) : (
          <ErrorState message={error} onRetry={reload} />
        ))}

      {!loading && !error && hall && (
        <>
          <div className="detail-layout">
            <div className="detail-main">
              <ImageCarousel images={hall.images} alt={hall.name} />

              <section className="section">
                <p className="eyebrow">Event hall</p>
                <h1 className="detail-title">{hall.name}</h1>
                {reviewSummary?.count > 0 && (
                  <p className="rating-line">
                    <Stars value={reviewSummary.average} /> {reviewSummary.average} · {reviewSummary.count} review
                    {reviewSummary.count > 1 ? "s" : ""}
                  </p>
                )}
                {hall.description && (
                  <div className="prose">
                    <p>{hall.description}</p>
                  </div>
                )}
              </section>

              {hall.amenities?.length > 0 && (
                <section className="section">
                  <h2>Amenities</h2>
                  <ul className="amenity-grid">
                    {hall.amenities.map((a) => (
                      <li key={a}>
                        <Icon name="check" size={16} /> {a}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="section" id="availability">
                <div className="section-head">
                  <div>
                    <h2>Availability</h2>
                    <p className="muted">Live booking calendar for {hall.name}.</p>
                  </div>
                </div>
                {isCustomer && (
                  <>
                    <AvailabilityCalendar hallId={hall._id} value={selectedDate} onChange={setSelectedDate} />
                    {selectedDate && (
                      <div className="card-actions">
                        <Link to={bookLink} className="button-link button-primary">
                          Continue booking for {formatDate(selectedDate, { day: "numeric", month: "short" })}
                          <Icon name="arrowRight" size={16} />
                        </Link>
                      </div>
                    )}
                  </>
                )}
                {!user && (
                  <EmptyState
                    icon="calendar"
                    title="Log in to check dates"
                    message="Sign in or create a free account to see which dates are open for this hall."
                  >
                    <Link to="/login" state={{ from: location }} className="button-link button-primary">
                      Log in
                    </Link>
                    <Link to="/register" state={{ from: location }} className="button-link">
                      Create account
                    </Link>
                  </EmptyState>
                )}
                {user && !isCustomer && (
                  <p className="notice">
                    Customers see this hall's availability calendar here.
                    {user.role !== ROLES.COORDINATOR && (
                      <Link to="/manage/calendar">Open the staff booking calendar →</Link>
                    )}
                  </p>
                )}
              </section>
            </div>

            <aside className="detail-side card">
              <div className="card-body">
                <p className="muted small">Hall price</p>
                <p className="price price-xl">{formatRs(hall.price)}</p>
                <dl className="facts">
                  <div>
                    <dt>
                      <Icon name="users" size={16} /> Capacity
                    </dt>
                    <dd>Up to {hall.capacity} guests</dd>
                  </div>
                  <div>
                    <dt>
                      <Icon name="check" size={16} /> Status
                    </dt>
                    <dd>{hall.isActive ? "Taking bookings" : "Not available"}</dd>
                  </div>
                  {hall.amenities?.length > 0 && (
                    <div>
                      <dt>
                        <Icon name="sparkles" size={16} /> Amenities
                      </dt>
                      <dd>{hall.amenities.length}</dd>
                    </div>
                  )}
                </dl>
                {canBook && (
                  <>
                    <Link to={bookLink} className="button-link button-primary block">
                      {selectedDate ? "Continue booking" : "Book this hall"}
                    </Link>
                    <a href="#availability" className="button-link block">
                      <Icon name="calendar" size={16} /> Check availability
                    </a>
                    <p className="muted small center">
                      Add food, décor & services and see your estimate before you send the request.
                    </p>
                  </>
                )}
              </div>
            </aside>
          </div>

          {pastEvents?.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>Events held here</h2>
                <Link to="/gallery" className="see-all">
                  View full gallery <Icon name="arrowRight" size={16} />
                </Link>
              </div>
              <div className="card-grid">
                {pastEvents.map((entry) => (
                  <GalleryCard key={entry._id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {reviewSummary?.count > 0 && (
            <section className="section">
              <h2>What customers say</h2>
              <div className="review-list">
                {reviewSummary.reviews.map((r) => (
                  <blockquote key={r._id} className="review">
                    <Stars value={r.rating} />
                    {r.comment && <p>“{r.comment}”</p>}
                    <footer className="muted small">
                      {r.reviewerName}
                      {r.eventType && ` · ${r.eventType}`} · {formatDate(r.createdAt)}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </section>
          )}

          {canBook && (
            <section className="cta-band">
              <div>
                <h2>Like what you see?</h2>
                <p>Pick your date, get tailored suggestions and see your estimated cost instantly.</p>
              </div>
              <Link to={bookLink} className="button-link button-primary">
                Start booking {hall.name}
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default HallDetailsPage;
