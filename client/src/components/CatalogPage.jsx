import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch.js";
import { useAuth } from "../context/AuthContext.jsx";
import CatalogGrid from "./CatalogGrid.jsx";
import ItemCard from "./ItemCard.jsx";
import PageHeader from "./PageHeader.jsx";

// Shared public browse page for packages / food / decorations / services:
// header, optional category filter chips, and a responsive card grid.
const CatalogPage = ({ title, eyebrow, lead, fetchFn, icon, detailPath, emptyTitle, priceNote, getIncludes }) => {
  const { data, loading, error, reload } = useFetch(fetchFn);
  const { user } = useAuth();
  const [category, setCategory] = useState("all");

  const categories = [...new Set((data || []).map((item) => item.category).filter(Boolean))];
  const items = (data || []).filter((item) => category === "all" || item.category === category);
  const canBook = !user || user.role === "customer";

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        lead={lead}
        actions={
          canBook && (
            <Link to="/booking" className="button-link button-primary">
              Add to an event
            </Link>
          )
        }
      />

      {categories.length > 1 && (
        <div className="chip-filter filter-bar" role="group" aria-label="Filter by category">
          {["all", ...categories].map((c) => (
            <button
              type="button"
              key={c}
              className={category === c ? "active" : ""}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      )}

      <CatalogGrid
        items={data ? items : data}
        loading={loading}
        error={error}
        onRetry={reload}
        emptyIcon={icon}
        emptyTitle={emptyTitle}
        emptyMessage="Please check back soon."
        renderItem={(item) => (
          <ItemCard
            item={item}
            icon={icon}
            to={detailPath ? `${detailPath}/${item._id}` : undefined}
            priceNote={priceNote}
            includes={getIncludes?.(item)}
          />
        )}
      />
    </div>
  );
};

export default CatalogPage;
