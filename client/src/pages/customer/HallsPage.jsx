import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { hallsApi } from "../../api/catalogApi.js";
import HallCard from "../../components/HallCard.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Icon from "../../components/Icon.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";

const SORTS = {
  recommended: { label: "Recommended", fn: () => 0 },
  priceAsc: { label: "Price: low to high", fn: (a, b) => a.price - b.price },
  priceDesc: { label: "Price: high to low", fn: (a, b) => b.price - a.price },
  capacityDesc: { label: "Largest first", fn: (a, b) => b.capacity - a.capacity },
};

const HallsPage = () => {
  const { data, loading, error, reload } = useFetch(hallsApi.listActive);
  const [guests, setGuests] = useState("");
  const [sort, setSort] = useState("recommended");

  const halls = useMemo(() => {
    const list = (data || []).filter((h) => !guests || h.capacity >= Number(guests));
    return [...list].sort(SORTS[sort].fn);
  }, [data, guests, sort]);

  return (
    <div>
      <PageHeader
        eyebrow="Venues"
        title="Our Halls"
        lead="Compare capacity, pricing and amenities, then open any hall for photos and live availability."
        actions={
          <Link to="/gallery" className="button-link">
            <Icon name="camera" size={16} /> See past events
          </Link>
        }
      />

      <div className="toolbar">
        <label>
          Number of guests
          <input
            type="number"
            min="1"
            placeholder="e.g. 150"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {!loading && !error && data?.length > 0 && (
          <span className="toolbar-result muted small" aria-live="polite">
            {halls.length} of {data.length} hall{data.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading && <LoadingState count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && halls.length === 0 && (
        <EmptyState
          icon="building"
          title={data?.length ? "No hall fits that guest count" : "No halls are currently available"}
          message={
            data?.length
              ? `No hall can seat ${guests} guests. Our largest hall seats ${Math.max(...data.map((h) => h.capacity))}.`
              : "Please check back soon."
          }
        >
          {data?.length > 0 && (
            <button type="button" onClick={() => setGuests("")}>
              Clear guest filter
            </button>
          )}
        </EmptyState>
      )}
      {!loading && !error && halls.length > 0 && (
        <div className="card-grid">
          {halls.map((hall) => (
            <HallCard key={hall._id} hall={hall} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HallsPage;
