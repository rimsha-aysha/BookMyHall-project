import { useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch.js";
import { useAuth } from "../context/AuthContext.jsx";
import Icon from "./Icon.jsx";
import { EmptyState, ErrorState } from "./States.jsx";
import { formatRs } from "../utils/format.js";

// Shared detail page for packages / food / decorations: back link, title
// block with category and price, description, optional included items, and
// a booking call to action.
const CatalogDetail = ({ fetchById, back, icon, notFoundTitle, includesTitle, getIncludes }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const fetchItem = useCallback(() => fetchById(id), [fetchById, id]);
  const { data: item, loading, error, reload } = useFetch(fetchItem);
  const canBook = !user || user.role === "customer";
  const includes = item ? getIncludes?.(item) || [] : [];

  return (
    <div>
      <Link to={back.to} className="breadcrumb">
        <Icon name="arrowLeft" size={16} /> {back.label}
      </Link>

      {loading && <div className="card skeleton" />}
      {error &&
        (error === "Not found" ? (
          <EmptyState icon={icon} title={notFoundTitle} message="It may have been removed or is no longer offered.">
            <Link to={back.to} className="button-link">
              {back.label}
            </Link>
          </EmptyState>
        ) : (
          <ErrorState message={error} onRetry={reload} />
        ))}

      {!loading && !error && item && (
        <div className="detail-layout">
          <article className="card">
            <div className="card-body">
              <div className="item-card-top">
                <span className="item-icon" aria-hidden="true">
                  <Icon name={icon} size={22} />
                </span>
                {item.category && <span className="eyebrow">{item.category}</span>}
              </div>
              <h1 className="detail-title">{item.name}</h1>
              {item.description ? (
                <div className="prose mt-8">
                  <p>{item.description}</p>
                </div>
              ) : (
                <p className="muted">No description provided.</p>
              )}
              {includes.length > 0 && (
                <>
                  <h3>{includesTitle}</h3>
                  <ul className="amenity-grid">
                    {includes.map((entry) => (
                      <li key={entry}>
                        <Icon name="check" size={16} /> {entry}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </article>

          <aside className="detail-side card">
            <div className="card-body">
              <p className="muted small">Price</p>
              <p className="price price-xl">{formatRs(item.price)}</p>
              {canBook ? (
                <>
                  <Link to="/booking" className="button-link button-primary block">
                    Add to a booking
                  </Link>
                  <p className="muted small center">Select it in the booking form — your estimate updates instantly.</p>
                </>
              ) : (
                <p className="muted small">Customers can add this while booking an event.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CatalogDetail;
