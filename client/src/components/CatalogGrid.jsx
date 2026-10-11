import { LoadingState, EmptyState, ErrorState } from "./States.jsx";

// Shared loading/error/empty handling for item collections. Each page
// supplies renderItem (the full card) since displayed fields differ per
// resource; `layout` picks a responsive card grid or a single-column list.
const CatalogGrid = ({ items, loading, error, onRetry, emptyTitle, emptyMessage, emptyIcon, layout = "grid", renderItem }) => {
  if (loading) return <LoadingState variant={layout === "list" ? "list" : "cards"} count={layout === "list" ? 4 : 3} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!items || items.length === 0) {
    return <EmptyState title={emptyTitle || "Nothing here yet"} message={emptyMessage} icon={emptyIcon} />;
  }

  return (
    <div className={layout === "list" ? "row-list" : "card-grid"}>
      {items.map((item) => (
        <div key={item._id} className="grid-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
};

export default CatalogGrid;
