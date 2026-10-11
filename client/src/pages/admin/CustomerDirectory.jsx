import { useState } from "react";
import { useFetch } from "../../hooks/useFetch.js";
import { reportApi } from "../../api/reportApi.js";
import PageHeader from "../../components/PageHeader.jsx";
import { LoadingState, EmptyState, ErrorState } from "../../components/States.jsx";

const CustomerDirectory = () => {
  const { data: customers, loading, error, reload } = useFetch(reportApi.getCustomerDirectory);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const shown = (customers || []).filter(
    (c) => !q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
  );

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Customers" lead="Every registered customer and how many bookings they have made." />

      {customers?.length > 0 && (
        <div className="toolbar">
          <label>
            Search
            <input type="search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <span className="toolbar-result muted small" aria-live="polite">
            Showing {shown.length} of {customers.length}
          </span>
        </div>
      )}

      {loading && <LoadingState variant="list" count={3} />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (!customers || customers.length === 0) && (
        <EmptyState icon="users" title="No customers yet" message="Customers appear here once they register." />
      )}
      {!loading && !error && customers?.length > 0 && shown.length === 0 && (
        <EmptyState icon="users" title="No matching customers" message="Try a different name or email." />
      )}
      {!loading && !error && shown.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Bookings</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.customerId}>
                <td data-label="Name">
                  <strong>{c.name}</strong>
                </td>
                <td data-label="Email">{c.email}</td>
                <td data-label="Bookings">{c.bookingCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CustomerDirectory;
