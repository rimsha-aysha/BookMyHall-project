import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { galleryApi } from "../../api/galleryApi.js";
import GalleryCard from "../../components/GalleryCard.jsx";

// All published entries are fetched once and filtered client-side — the
// gallery is small and this keeps the filter chips instant.
const fetchGallery = () => galleryApi.listPublished();

const GalleryPage = () => {
  const { data, loading, error, reload } = useFetch(fetchGallery);
  const [eventType, setEventType] = useState("all");
  const [hallId, setHallId] = useState("all");

  const eventTypes = useMemo(() => [...new Set((data || []).map((e) => e.eventType))].sort(), [data]);
  const halls = useMemo(() => {
    const map = new Map();
    (data || []).forEach((e) => e.hall && map.set(e.hall._id, e.hall.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const entries = (data || []).filter(
    (e) => (eventType === "all" || e.eventType === eventType) && (hallId === "all" || e.hall?._id === hallId)
  );
  const photoCount = entries.reduce((sum, e) => sum + (e.images?.length || 0), 0);

  return (
    <div>
      <div className="page-head">
        <h1>Past Events</h1>
        <p className="lead">
          Weddings, birthdays, corporate events and more — real events we've hosted in our halls. Open any event
          to see all of its photos.
        </p>
      </div>

      {!loading && !error && data?.length > 0 && (
        <div className="toolbar">
          <div className="chip-filter" role="group" aria-label="Filter by event type">
            <button type="button" className={eventType === "all" ? "active" : ""} onClick={() => setEventType("all")}>
              All
            </button>
            {eventTypes.map((t) => (
              <button type="button" key={t} className={eventType === t ? "active" : ""} onClick={() => setEventType(t)}>
                {t}
              </button>
            ))}
          </div>
          {halls.length > 1 && (
            <label>
              Hall
              <select value={hallId} onChange={(e) => setHallId(e.target.value)}>
                <option value="all">All halls</option>
                {halls.map(([hid, name]) => (
                  <option key={hid} value={hid}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {loading && <div className="card-grid">{[1, 2, 3, 4].map((i) => <div key={i} className="card skeleton" />)}</div>}
      {error && (
        <div className="state-box" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && (!data || data.length === 0) && (
        <div className="state-box">
          <p>No past events have been published yet. Check back soon!</p>
          <Link to="/halls">Browse our halls instead</Link>
        </div>
      )}
      {!loading && !error && data?.length > 0 && entries.length === 0 && (
        <div className="state-box">
          <p>No events match these filters.</p>
          <button
            type="button"
            onClick={() => {
              setEventType("all");
              setHallId("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      {!loading && !error && entries.length > 0 && (
        <>
          <p className="muted small">
            {entries.length} event{entries.length === 1 ? "" : "s"} · {photoCount} photos
          </p>
          <div className="card-grid">
            {entries.map((entry) => (
              <GalleryCard key={entry._id} entry={entry} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default GalleryPage;
